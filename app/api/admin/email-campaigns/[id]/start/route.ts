import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { buildCampaignAudience } from "@/app/lib/server/email/campaign-audience";
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
  assertDynamoTablesConfigured,
  DYNAMO_TABLE_ENVS,
} from "@/app/lib/server/dynamo";
import {
  createEmailCampaignRecipient,
  getEmailCampaign,
  markEmailCampaignQueued,
  markEmailCampaignQueueFailed,
  markEmailCampaignQueueing,
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
        "Campaign draft was not found.",
      );
    }

    if (
      !areAdminCampaignsEnabled() ||
      !isAdminEmailBulkSendEnabled() ||
      !isAdminEmailBulkInfraReady()
    ) {
      await recordAdminCampaignAudit({
        action: "production_send_blocked",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: "feature_flags_disabled",
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
        code: "production_send_disabled",
        message:
          "Production campaign sending is blocked until the infrastructure readiness gate is enabled.",
      });
    }

    if (campaign.status !== "approved") {
      throw new PublicApiError(
        409,
        "campaign_not_approved",
        "Approve this campaign before starting the production send.",
      );
    }

    const audience = await buildCampaignAudience();
    const expectedPhrase = `SEND TO ${audience.eligibleCount} SUBSCRIBERS`;

    if (submission.confirmationPhrase !== expectedPhrase) {
      throw new PublicApiError(
        400,
        "confirmation_phrase_mismatch",
        "The confirmation phrase does not match the current eligible recipient count.",
      );
    }

    assertDynamoTablesConfigured(DYNAMO_TABLE_ENVS.emailCampaignRecipients);

    if (!process.env.ADMIN_EMAIL_CAMPAIGN_QUEUE_URL?.trim()) {
      throw new PublicApiError(
        503,
        "campaign_queue_not_configured",
        "Production campaign queueing is not fully configured.",
      );
    }

    const now = new Date().toISOString();
    const queueing = await markEmailCampaignQueueing({
      id,
      expectedVersion: submission.expectedVersion,
      now,
      queued_by: admin.identifier,
    });

    if (!queueing) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This campaign changed in another session. Reload it and try again.",
      );
    }

    await recordAdminCampaignAudit({
      action: "queueing_started",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: `eligible=${audience.eligibleCount}`,
    });

    let queuedCount = 0;

    try {
      for (const candidate of audience.candidates) {
        if (!candidate.decision.eligible) {
          await createEmailCampaignRecipient({
            campaignId: id,
            subscriberId: candidate.subscriber.id,
            now,
            status: "skipped",
            eligibilityDecision: "excluded",
            skipReason: candidate.decision.reason,
          });
          continue;
        }

        const recipient = await createEmailCampaignRecipient({
          campaignId: id,
          subscriberId: candidate.subscriber.id,
          now,
          status: "queueing",
          eligibilityDecision: "eligible",
        });

        if (!recipient) {
          continue;
        }

        const queueResult = await enqueueEmailCampaignRecipient({
          campaignId: id,
          subscriberId: candidate.subscriber.id,
        });

        await markEmailCampaignRecipientQueued({
          campaignId: id,
          subscriberId: candidate.subscriber.id,
          now: new Date().toISOString(),
          sqsMessageId: queueResult.MessageId,
        });

        queuedCount += 1;
      }
    } catch (error) {
      console.error("[admin-email] queueing failed", {
        campaignId: id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });

      await markEmailCampaignQueueFailed({
        id,
        now: new Date().toISOString(),
        updated_by: admin.identifier,
        failureCode: "queueing_failed",
      }).catch((updateError) => {
        console.error("[admin-email] queue failure tracking failed", {
          campaignId: id,
          errorName:
            updateError instanceof Error ? updateError.name : "UnknownError",
        });
      });

      await recordAdminCampaignAudit({
        action: "queueing_failed",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: "queueing_failed",
      }).catch(() => undefined);

      throw new PublicApiError(
        503,
        "campaign_queueing_failed",
        "Campaign queueing failed. Review logs before retrying.",
      );
    }

    const queued = await markEmailCampaignQueued({
      id,
      now: new Date().toISOString(),
      updated_by: admin.identifier,
      eligibleCount: audience.eligibleCount,
      excludedCount: audience.excludedCount,
      queuedCount,
    });

    await recordAdminCampaignAudit({
      action: "campaign_queued",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: `queued=${queuedCount} excluded=${audience.excludedCount}`,
    });

    return NextResponse.json({
      ok: true,
      status: "queued",
      campaign: queued
        ? {
            id: queued.id,
            status: queued.status,
            version: queued.version,
            recipientCount: queued.recipient_count || 0,
            queuedCount: queued.queued_count || 0,
            skippedCount: queued.skipped_count || 0,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
