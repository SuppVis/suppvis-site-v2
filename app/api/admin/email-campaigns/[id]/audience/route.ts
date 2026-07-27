import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { buildCampaignAudience } from "@/app/lib/server/email/campaign-audience";
import {
  hasCurrentAdminTests,
  hasCurrentEmailPreview,
  hasCurrentSmsPreview,
  hasSavedSmsDraft,
} from "@/app/lib/server/email/campaign-readiness";
import {
  handleApiError,
  PersistenceError,
  PublicApiError,
} from "@/app/lib/server/errors";
import {
  getEmailCampaign,
  markEmailCampaignAudienceCounted,
  markEmailCampaignAudienceCountFailed,
  type EmailCampaignRecord,
} from "@/app/lib/server/persistence";
import { enforceRateLimit } from "@/app/lib/server/request";
import { buildSmsCampaignAudience } from "@/app/lib/server/sms/campaign-audience";
import { adminCampaignIdSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function confirmationPhraseForCounts(emailCount: number, smsCount: number) {
  if (emailCount > 0 && smsCount > 0) {
    return `SEND EMAIL TO ${emailCount} AND TEXT TO ${smsCount}`;
  }

  if (emailCount > 0) {
    return `SEND EMAIL TO ${emailCount}`;
  }

  if (smsCount > 0) {
    return `SEND TEXT TO ${smsCount}`;
  }

  return "";
}

function statusGroups(
  candidates: Array<{ subscriber: { status?: string } }>,
) {
  return candidates.reduce<Record<string, number>>((groups, candidate) => {
    const status = candidate.subscriber.status || "unknown";
    groups[status] = (groups[status] || 0) + 1;
    return groups;
  }, {});
}

function exclusionGroups(
  candidates: Array<{
    decision: { eligible: true } | { eligible: false; reason: string };
  }>,
) {
  return candidates.reduce<Record<string, number>>((groups, candidate) => {
    if (candidate.decision.eligible) {
      return groups;
    }

    groups[candidate.decision.reason] =
      (groups[candidate.decision.reason] || 0) + 1;
    return groups;
  }, {});
}

function audienceCampaignResponse(record: EmailCampaignRecord) {
  return {
    id: record.id,
    status: record.status,
    updatedAt: record.updated_at,
    version: record.version,
    audienceCountedAt: record.audience_counted_at || null,
    audienceVersion: record.audience_version || 0,
    audienceEmailTotal: record.audience_email_total || 0,
    audienceEmailEligible: record.audience_email_eligible || 0,
    audienceEmailExcluded: record.audience_email_excluded || 0,
    audienceEmailDuplicateCount:
      record.audience_email_duplicate_count || 0,
    audienceSmsTotal: record.audience_sms_total || 0,
    audienceSmsEligible: record.audience_sms_eligible || 0,
    audienceSmsExcluded: record.audience_sms_excluded || 0,
    audienceSmsDuplicateCount: record.audience_sms_duplicate_count || 0,
    audienceBothEligible: record.audience_both_eligible ?? null,
    audienceLastErrorCode: record.audience_last_error_code || null,
    audienceLastErrorAt: record.audience_last_error_at || null,
  };
}

function audienceErrorCode(error: unknown) {
  if (
    error instanceof PersistenceError &&
    error.causeName === "AccessDeniedException"
  ) {
    return "audience_query_access_denied";
  }

  if (
    error instanceof PersistenceError &&
    error.code === "dynamodb_query_failed"
  ) {
    return "audience_query_failed";
  }

  return "audience_refresh_failed";
}

function audienceErrorMessage(code: string) {
  if (code === "audience_query_access_denied") {
    return "Recipient counting cannot read the subscriber status index. Update the AWS IAM policy and try again.";
  }

  if (code === "audience_query_failed") {
    return "Recipient counting could not read the subscriber records. Try again after the database issue is resolved.";
  }

  return "Recipient counts could not be refreshed. Try again later.";
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let adminIdentifierForFailure: string | null = null;
  let campaignForFailure: EmailCampaignRecord | null = null;

  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-audience",
      limit: 20,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    adminIdentifierForFailure = admin.identifier;
    const id = adminCampaignIdSchema.parse(params.id);
    const campaign = await getEmailCampaign(id);
    campaignForFailure = campaign;

    if (!campaign) {
      throw new PublicApiError(
        404,
        "campaign_not_found",
        "Email draft was not found.",
      );
    }

    if (!hasCurrentEmailPreview(campaign)) {
      throw new PublicApiError(
        409,
        "email_preview_required",
        campaign.email_preview_generated_at
          ? "The email preview is out of date. Generate it again."
          : "Generate the email preview before reviewing recipients.",
      );
    }

    if (!hasSavedSmsDraft(campaign)) {
      throw new PublicApiError(
        409,
        "sms_draft_not_saved",
        "Save the text message before reviewing recipients.",
      );
    }

    if (!hasCurrentSmsPreview(campaign)) {
      throw new PublicApiError(
        409,
        "sms_preview_required",
        campaign.sms_preview_generated_at
          ? "The text preview is out of date. Generate it again."
          : "Generate the text preview before reviewing recipients.",
      );
    }

    if (!hasCurrentAdminTests(campaign)) {
      throw new PublicApiError(
        409,
        "campaign_not_ready",
        "Complete both admin tests before reviewing recipients.",
      );
    }

    console.info("[admin-email] audience refresh started", {
      campaignId: id,
      campaignVersion: campaign.version,
    });

    const emailAudience = await buildCampaignAudience();
    console.info("[admin-email] audience email query completed", {
      campaignId: id,
      total: emailAudience.totalCount,
      eligible: emailAudience.eligibleCount,
      excluded: emailAudience.excludedCount,
      duplicates: emailAudience.duplicateCount,
    });

    const smsAudience = await buildSmsCampaignAudience();
    const countedAt = new Date().toISOString();
    console.info("[admin-email] audience sms query completed", {
      campaignId: id,
      total: smsAudience.totalCount,
      eligible: smsAudience.eligibleCount,
      excluded: smsAudience.excludedCount,
      duplicates: smsAudience.duplicateCount,
    });

    const persisted = await markEmailCampaignAudienceCounted({
      id,
      expectedVersion: campaign.version,
      now: countedAt,
      updated_by: admin.identifier,
      emailTotalCount: emailAudience.totalCount,
      emailEligibleCount: emailAudience.eligibleCount,
      emailExcludedCount: emailAudience.excludedCount,
      emailDuplicateCount: emailAudience.duplicateCount,
      smsTotalCount: smsAudience.totalCount,
      smsEligibleCount: smsAudience.eligibleCount,
      smsExcludedCount: smsAudience.excludedCount,
      smsDuplicateCount: smsAudience.duplicateCount,
      bothEligibleCount: null,
    });

    if (!persisted) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This announcement changed while recipients were being counted. Reload it and try again.",
      );
    }

    await recordAdminCampaignAudit({
      action: "recipient_count_generated",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: `email=${emailAudience.eligibleCount} sms=${smsAudience.eligibleCount}`,
    });

    const confirmationPhrase = confirmationPhraseForCounts(
      emailAudience.eligibleCount,
      smsAudience.eligibleCount,
    );
    const diagnostics = {
      emailRecordsExamined: emailAudience.totalCount,
      emailEligible: emailAudience.eligibleCount,
      emailExcluded: emailAudience.excludedCount,
      emailStatusGroups: statusGroups(emailAudience.candidates),
      emailExclusionGroups: exclusionGroups(emailAudience.candidates),
      smsRecordsExamined: smsAudience.totalCount,
      smsEligible: smsAudience.eligibleCount,
      smsExcluded: smsAudience.excludedCount,
      smsStatusGroups: statusGroups(smsAudience.candidates),
      smsExclusionGroups: exclusionGroups(smsAudience.candidates),
      lastRefreshResult: "success",
    };

    console.info("[admin-email] audience refresh persisted", {
      campaignId: id,
      campaignVersion: campaign.version,
      countedAt,
      emailEligible: emailAudience.eligibleCount,
      smsEligible: smsAudience.eligibleCount,
    });

    return NextResponse.json({
      ok: true,
      audience: {
        totalCount: emailAudience.totalCount,
        eligibleCount: emailAudience.eligibleCount,
        excludedCount: emailAudience.excludedCount,
        duplicateCount: emailAudience.duplicateCount,
        countedAt,
        smsTotalCount: smsAudience.totalCount,
        smsEligibleCount: smsAudience.eligibleCount,
        smsExcludedCount: smsAudience.excludedCount,
        smsDuplicateCount: smsAudience.duplicateCount,
        smsIncluded: true,
        receivingBothCount: null,
        confirmationPhrase,
        diagnostics,
      },
      campaign: audienceCampaignResponse(persisted),
    });
  } catch (error) {
    const code = audienceErrorCode(error);

    if (
      campaignForFailure &&
      adminIdentifierForFailure &&
      error instanceof PersistenceError
    ) {
      const now = new Date().toISOString();

      await markEmailCampaignAudienceCountFailed({
        id: campaignForFailure.id,
        expectedVersion: campaignForFailure.version,
        now,
        updated_by: adminIdentifierForFailure,
        errorCode: code,
      }).catch((persistError) => {
        console.error("[admin-email] audience failure state update failed", {
          campaignId: campaignForFailure?.id,
          errorName:
            persistError instanceof Error ? persistError.name : "UnknownError",
        });
      });

      await recordAdminCampaignAudit({
        action: "recipient_count_failed",
        adminIdentifier: adminIdentifierForFailure,
        campaignId: campaignForFailure.id,
        status: code,
      }).catch((auditError) => {
        console.error("[admin-email] audience failure audit failed", {
          campaignId: campaignForFailure?.id,
          errorName:
            auditError instanceof Error ? auditError.name : "UnknownError",
        });
      });

      console.error("[admin-email] audience refresh failed", {
        campaignId: campaignForFailure.id,
        campaignVersion: campaignForFailure.version,
        errorCode: code,
        errorName: error.causeName || error.name,
      });

      return NextResponse.json(
        {
          ok: false,
          code,
          message: audienceErrorMessage(code),
        },
        { status: code === "audience_query_access_denied" ? 503 : 500 },
      );
    }

    return handleApiError(error);
  }
}
