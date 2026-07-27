import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import {
  buildAudienceHealth,
  buildAudienceSnapshot,
  confirmationPhraseForCounts,
} from "@/app/lib/server/admin/audience";
import {
  campaignReadinessResponse,
  hasCurrentAdminTests,
  hasCurrentEmailPreview,
  hasCurrentSmsPreview,
  hasSavedSmsDraft,
} from "@/app/lib/server/email/campaign-readiness";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  getEmailCampaign,
  markEmailCampaignAudienceCounted,
  type EmailCampaignRecord,
} from "@/app/lib/server/persistence";
import { enforceRateLimit } from "@/app/lib/server/request";
import { adminCampaignIdSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    audienceEmailStatus: record.audience_email_status || "not_counted",
    audienceEmailErrorCode: record.audience_email_error_code || null,
    audienceSmsTotal: record.audience_sms_total || 0,
    audienceSmsEligible: record.audience_sms_eligible || 0,
    audienceSmsExcluded: record.audience_sms_excluded || 0,
    audienceSmsDuplicateCount: record.audience_sms_duplicate_count || 0,
    audienceSmsStatus: record.audience_sms_status || "not_counted",
    audienceSmsErrorCode: record.audience_sms_error_code || null,
    audienceBothEligible: record.audience_both_eligible ?? null,
    audienceLastErrorCode: record.audience_last_error_code || null,
    audienceLastErrorAt: record.audience_last_error_at || null,
    readiness: campaignReadinessResponse(record),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const [snapshot, health] = await Promise.all([
      buildAudienceSnapshot(),
      buildAudienceHealth(),
    ]);
    console.info("[admin-email] audience channels completed", {
      campaignId: id,
      emailStatus: snapshot.email.status,
      emailEligible: snapshot.email.eligibleCount,
      emailErrorCode: snapshot.email.errorCode,
      smsStatus: snapshot.sms.status,
      smsEligible: snapshot.sms.eligibleCount,
      smsErrorCode: snapshot.sms.errorCode,
      refreshResult: snapshot.refreshResult,
    });

    const persisted = await markEmailCampaignAudienceCounted({
      id,
      expectedVersion: campaign.version,
      now: snapshot.countedAt,
      updated_by: admin.identifier,
      emailTotalCount: snapshot.email.totalCount,
      emailEligibleCount: snapshot.email.eligibleCount,
      emailExcludedCount: snapshot.email.excludedCount,
      emailDuplicateCount: snapshot.email.duplicateCount,
      emailStatus: snapshot.email.status,
      emailErrorCode: snapshot.email.errorCode,
      smsTotalCount: snapshot.sms.totalCount,
      smsEligibleCount: snapshot.sms.eligibleCount,
      smsExcludedCount: snapshot.sms.excludedCount,
      smsDuplicateCount: snapshot.sms.duplicateCount,
      smsStatus: snapshot.sms.status,
      smsErrorCode: snapshot.sms.errorCode,
      bothEligibleCount:
        snapshot.email.status === "success" && snapshot.sms.status === "success"
          ? null
          : null,
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
      status: `email=${snapshot.email.status}:${snapshot.email.eligibleCount} sms=${snapshot.sms.status}:${snapshot.sms.eligibleCount}`,
    });

    const confirmationPhrase = confirmationPhraseForCounts(
      snapshot.email.status === "success" ? snapshot.email.eligibleCount : 0,
      snapshot.sms.status === "success" ? snapshot.sms.eligibleCount : 0,
    );
    const diagnostics = {
      emailEligible: snapshot.email.eligibleCount,
      emailErrorCode: snapshot.email.errorCode,
      emailExcluded: snapshot.email.excludedCount,
      emailExclusionGroups: snapshot.email.exclusionGroups,
      emailIndexName: snapshot.email.indexName,
      emailQueryStatus: snapshot.email.status,
      emailRecordsExamined: snapshot.email.totalCount,
      emailStatusGroups: snapshot.email.statusGroups,
      emailTableName: snapshot.email.tableName,
      health,
      lastRefreshResult: snapshot.refreshResult,
      smsEligible: snapshot.sms.eligibleCount,
      smsErrorCode: snapshot.sms.errorCode,
      smsExcluded: snapshot.sms.excludedCount,
      smsExclusionGroups: snapshot.sms.exclusionGroups,
      smsIndexName: snapshot.sms.indexName,
      smsQueryStatus: snapshot.sms.status,
      smsRecordsExamined: snapshot.sms.totalCount,
      smsStatusGroups: snapshot.sms.statusGroups,
      smsTableName: snapshot.sms.tableName,
    };

    console.info("[admin-email] audience refresh persisted", {
      campaignId: id,
      campaignVersion: campaign.version,
      countedAt: snapshot.countedAt,
      emailEligible: snapshot.email.eligibleCount,
      emailStatus: snapshot.email.status,
      smsEligible: snapshot.sms.eligibleCount,
      smsStatus: snapshot.sms.status,
    });

    return NextResponse.json({
      ok: true,
      audience: {
        totalCount: snapshot.email.totalCount,
        eligibleCount: snapshot.email.eligibleCount,
        excludedCount: snapshot.email.excludedCount,
        duplicateCount: snapshot.email.duplicateCount,
        countedAt: snapshot.countedAt,
        emailStatus: snapshot.email.status,
        emailErrorCode: snapshot.email.errorCode,
        smsTotalCount: snapshot.sms.totalCount,
        smsEligibleCount: snapshot.sms.eligibleCount,
        smsExcludedCount: snapshot.sms.excludedCount,
        smsDuplicateCount: snapshot.sms.duplicateCount,
        smsStatus: snapshot.sms.status,
        smsErrorCode: snapshot.sms.errorCode,
        smsIncluded: true,
        receivingBothCount: null,
        confirmationPhrase,
        diagnostics,
      },
      campaign: audienceCampaignResponse(persisted),
    });
  } catch (error) {
    console.error("[admin-email] audience route failed", {
      campaignId: campaignForFailure?.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return handleApiError(error);
  }
}
