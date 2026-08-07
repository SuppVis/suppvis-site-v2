import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import {
  audienceErrorCode,
  confirmationPhraseForCounts,
} from "@/app/lib/server/admin/audience";
import { betaAudienceSegmentAuditValue } from "@/app/lib/server/beta-priority";
import { buildCampaignAudience } from "@/app/lib/server/email/campaign-audience";
import {
  getEmailCampaignReadiness,
} from "@/app/lib/server/email/campaign-readiness";
import {
  enqueueEmailCampaignRecipient,
  isAdminEmailBulkInfraReady,
} from "@/app/lib/server/email/campaign-queue";
import {
  areAdminCampaignsEnabled,
  isAdminEmailBulkSendEnabled,
} from "@/app/lib/server/email/admin-campaign";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  createEmailCampaignRecipient,
  getEmailCampaign,
  markEmailCampaignQueueFailed,
  markEmailCampaignQueueing,
  markEmailCampaignQueued,
  markEmailCampaignRecipientQueued,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  adminCampaignIdSchema,
  adminCampaignStartSchema,
} from "@/app/lib/server/validation";
import { buildSmsCampaignAudience } from "@/app/lib/server/sms/campaign-audience";
import {
  areAdminSmsAnnouncementsEnabled,
  isAdminSmsBulkInfraReady,
  isAdminSmsBulkSendEnabled,
} from "@/app/lib/server/sms/admin-campaign";
import { enqueueSmsCampaignRecipient } from "@/app/lib/server/sms/campaign-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-start",
      limit: 5,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const body = await readJsonBody(request);
    const submission = adminCampaignStartSchema.parse(body);
    const campaign = await getEmailCampaign(id);

    if (!campaign) {
      throw new PublicApiError(
        404,
        "campaign_not_found",
        "Email draft was not found.",
      );
    }

    if (campaign.status !== "approved") {
      throw new PublicApiError(
        409,
        "campaign_not_approved",
        "Approve this announcement before sending it.",
      );
    }

    if (campaign.version !== submission.expectedVersion) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This announcement changed in another session. Reload it and try again.",
      );
    }

    const readiness = getEmailCampaignReadiness(campaign);

    if (!readiness.text_saved_current) {
      throw new PublicApiError(
        409,
        "sms_draft_not_saved",
        "Save the text message before sending this announcement.",
      );
    }

    if (!readiness.email_preview_current || !readiness.text_preview_current) {
      throw new PublicApiError(
        409,
        "preview_stale",
        "Generate current email and text previews before sending.",
      );
    }

    if (!readiness.email_test_current || !readiness.text_test_current) {
      throw new PublicApiError(
        409,
        "campaign_not_tested",
        "Complete both admin tests before sending.",
      );
    }

    const [emailAudienceResult, smsAudienceResult] = await Promise.allSettled([
      buildCampaignAudience({ audienceSegment: campaign.audience_segment || "all" }),
      buildSmsCampaignAudience({ audienceSegment: campaign.audience_segment || "all" }),
    ]);
    const emailAudience =
      emailAudienceResult.status === "fulfilled"
        ? emailAudienceResult.value
        : null;
    const smsAudience =
      smsAudienceResult.status === "fulfilled" ? smsAudienceResult.value : null;

    if (
      emailAudienceResult.status === "rejected" ||
      smsAudienceResult.status === "rejected"
    ) {
      console.error("[admin-email] production send audience unavailable", {
        campaignId: id,
        emailErrorCode:
          emailAudienceResult.status === "rejected"
            ? audienceErrorCode(emailAudienceResult.reason)
            : null,
        smsErrorCode:
          smsAudienceResult.status === "rejected"
            ? audienceErrorCode(smsAudienceResult.reason)
            : null,
      });

      throw new PublicApiError(
        503,
        "audience_channel_unavailable",
        "Subscriber eligibility is unavailable for at least one channel. Refresh recipients again after the database issue is resolved.",
      );
    }

    const emailRecipientsRequired = (emailAudience?.eligibleCount || 0) > 0;
    const smsRecipientsRequired = (smsAudience?.eligibleCount || 0) > 0;
    const expectedPhrase = confirmationPhraseForCounts(
      emailAudience?.eligibleCount || 0,
      smsAudience?.eligibleCount || 0,
    );

    if (submission.confirmationPhrase !== expectedPhrase) {
      throw new PublicApiError(
        400,
        "confirmation_phrase_mismatch",
        "The confirmation phrase does not match the current eligible recipient count.",
      );
    }

    if (!emailRecipientsRequired && !smsRecipientsRequired) {
      throw new PublicApiError(
        409,
        "announcement_audience_empty",
        "There are currently no eligible beta subscribers. The announcement cannot be sent yet.",
      );
    }

    const emailReady =
      areAdminCampaignsEnabled() &&
      isAdminEmailBulkSendEnabled() &&
      isAdminEmailBulkInfraReady();
    const smsReady =
      areAdminSmsAnnouncementsEnabled() &&
      isAdminSmsBulkSendEnabled() &&
      isAdminSmsBulkInfraReady();

    if (emailRecipientsRequired && !emailReady) {
      await recordAdminCampaignAudit({
        action: "production_send_blocked",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: "email_feature_flags_disabled",
      }).catch((auditError) => {
        console.error("[admin-email] blocked production send audit failed", {
          campaignId: id,
          errorName:
            auditError instanceof Error ? auditError.name : "UnknownError",
        });
      });

      return NextResponse.json({
        ok: true,
        status: "disabled",
        code: "email_production_send_disabled",
        message:
          "Sending is not available yet because email delivery is still being prepared.",
      });
    }

    if (smsRecipientsRequired && !smsReady) {
      await recordAdminCampaignAudit({
        action: "sms_production_send_blocked",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: "sms_feature_flags_disabled",
      });

      return NextResponse.json({
        ok: true,
        status: "disabled",
        code: "sms_production_send_disabled",
        message:
          "Sending is not available yet because the text delivery system is still being prepared.",
      });
    }

    if (!emailAudience || !smsAudience) {
      throw new PublicApiError(
        503,
        "audience_unavailable",
        "Recipient counts could not be refreshed.",
      );
    }

    const queueingAt = new Date().toISOString();
    const queueingCampaign = await markEmailCampaignQueueing({
      id,
      expectedVersion: submission.expectedVersion,
      now: queueingAt,
      queued_by: admin.identifier,
    });

    if (!queueingCampaign) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This announcement changed before queueing could start. Reload it and try again.",
      );
    }

    let queuedEmailCount = 0;
    let queuedSmsCount = 0;

    try {
      for (const candidate of emailAudience.candidates) {
        const queuedAt = new Date().toISOString();

        if (candidate.decision.eligible) {
          await createEmailCampaignRecipient({
            campaignId: id,
            channel: "email",
            subscriberId: candidate.subscriber.id,
            now: queuedAt,
            status: "queueing",
            eligibilityDecision: "eligible",
          });

          const sqsMessage = await enqueueEmailCampaignRecipient({
            campaignId: id,
            subscriberId: candidate.subscriber.id,
          });

          await markEmailCampaignRecipientQueued({
            campaignId: id,
            subscriberId: candidate.subscriber.id,
            now: new Date().toISOString(),
            sqsMessageId: sqsMessage.MessageId,
          });

          queuedEmailCount += 1;
        } else {
          await createEmailCampaignRecipient({
            campaignId: id,
            channel: "email",
            subscriberId: candidate.subscriber.id,
            now: queuedAt,
            status: "skipped",
            eligibilityDecision: "excluded",
            skipReason: candidate.decision.reason,
          });
        }
      }

      for (const candidate of smsAudience.candidates) {
        const queuedAt = new Date().toISOString();

        if (candidate.decision.eligible) {
          await createEmailCampaignRecipient({
            campaignId: id,
            channel: "sms",
            subscriberId: candidate.subscriber.id,
            now: queuedAt,
            status: "queueing",
            eligibilityDecision: "eligible",
          });

          const sqsMessage = await enqueueSmsCampaignRecipient({
            campaignId: id,
            subscriberId: candidate.subscriber.id,
          });

          await markEmailCampaignRecipientQueued({
            campaignId: id,
            subscriberId: candidate.subscriber.id,
            now: new Date().toISOString(),
            sqsMessageId: sqsMessage.MessageId,
          });

          queuedSmsCount += 1;
        } else {
          await createEmailCampaignRecipient({
            campaignId: id,
            channel: "sms",
            subscriberId: candidate.subscriber.id,
            now: queuedAt,
            status: "skipped",
            eligibilityDecision: "excluded",
            skipReason: candidate.decision.reason,
          });
        }
      }

      const queuedAt = new Date().toISOString();
      const queuedCampaign = await markEmailCampaignQueued({
        id,
        now: queuedAt,
        updated_by: admin.identifier,
        eligibleCount: emailAudience?.eligibleCount || 0,
        excludedCount: emailAudience?.excludedCount || 0,
        queuedCount: queuedEmailCount,
        smsEligibleCount: smsAudience?.eligibleCount || 0,
        smsExcludedCount: smsAudience?.excludedCount || 0,
        smsDuplicateCount: smsAudience?.duplicateCount || 0,
        smsQueuedCount: queuedSmsCount,
      });

      await recordAdminCampaignAudit({
        action: "campaign_queued",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: `audience=${betaAudienceSegmentAuditValue(campaign.audience_segment || "all")} email=${queuedEmailCount} sms=${queuedSmsCount}`,
      });

      console.info("[admin-email] production queue completed", {
        campaignId: id,
        audienceSegment: campaign.audience_segment || "all",
        emailEligible: emailAudience.eligibleCount,
        emailExcluded: emailAudience.excludedCount,
        emailQueued: queuedEmailCount,
        smsEligible: smsAudience.eligibleCount,
        smsExcluded: smsAudience.excludedCount,
        smsQueued: queuedSmsCount,
      });

      return NextResponse.json({
        ok: true,
        status: "queued",
        emailQueuedCount: queuedEmailCount,
        smsQueuedCount: queuedSmsCount,
        campaign: queuedCampaign,
        message: "Announcement queued.",
      });
    } catch (queueError) {
      await markEmailCampaignQueueFailed({
        id,
        now: new Date().toISOString(),
        updated_by: admin.identifier,
        failureCode: "queue_failed",
      }).catch((failureError) => {
        console.error("[admin-email] queue failure update failed", {
          campaignId: id,
          errorName:
            failureError instanceof Error ? failureError.name : "UnknownError",
        });
      });

      console.error("[admin-email] production queue failed", {
        campaignId: id,
        errorName:
          queueError instanceof Error ? queueError.name : "UnknownError",
      });

      throw new PublicApiError(
        500,
        "queue_failed",
        "The announcement could not be queued. Try again later.",
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
