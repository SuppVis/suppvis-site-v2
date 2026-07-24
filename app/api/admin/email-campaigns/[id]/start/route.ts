import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { buildCampaignAudience } from "@/app/lib/server/email/campaign-audience";
import {
  hasCurrentAdminTests,
  hasCurrentEmailPreview,
  hasCurrentSmsPreview,
} from "@/app/lib/server/email/campaign-readiness";
import { isAdminEmailBulkInfraReady } from "@/app/lib/server/email/campaign-queue";
import {
  areAdminCampaignsEnabled,
  isAdminEmailBulkSendEnabled,
} from "@/app/lib/server/email/admin-campaign";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import { getEmailCampaign } from "@/app/lib/server/persistence";
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
          "Sending is not available yet because announcement delivery is still being prepared.",
      });
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

    if (
      !campaign.sms_enabled ||
      !campaign.sms_saved_at ||
      !campaign.sms_body ||
      !campaign.sms_rendered_body
    ) {
      throw new PublicApiError(
        409,
        "sms_draft_not_saved",
        "Save the text message before sending this announcement.",
      );
    }

    if (!hasCurrentEmailPreview(campaign) || !hasCurrentSmsPreview(campaign)) {
      throw new PublicApiError(
        409,
        "preview_stale",
        "Generate current email and text previews before sending.",
      );
    }

    if (!hasCurrentAdminTests(campaign)) {
      throw new PublicApiError(
        409,
        "campaign_not_tested",
        "Complete both admin tests before sending.",
      );
    }

    const emailAudience = await buildCampaignAudience();
    const smsAudience = await buildSmsCampaignAudience();
    const expectedPhrase = `SEND EMAIL TO ${emailAudience.eligibleCount} AND TEXT TO ${smsAudience.eligibleCount}`;

    if (submission.confirmationPhrase !== expectedPhrase) {
      throw new PublicApiError(
        400,
        "confirmation_phrase_mismatch",
        "The confirmation phrase does not match the current eligible recipient count.",
      );
    }

    if (emailAudience.eligibleCount === 0 || smsAudience.eligibleCount === 0) {
      throw new PublicApiError(
        409,
        "announcement_audience_incomplete",
        "Both email and text need at least one eligible recipient before sending.",
      );
    }

    const smsReady =
      areAdminSmsAnnouncementsEnabled() &&
      isAdminSmsBulkSendEnabled() &&
      isAdminSmsBulkInfraReady();

    await recordAdminCampaignAudit({
      action: "sms_production_send_blocked",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: smsReady
        ? "sms_worker_not_connected"
        : "sms_feature_flags_disabled",
    });

    return NextResponse.json({
      ok: true,
      status: "disabled",
      code: "sms_production_send_disabled",
      message: smsReady
        ? "Sending is not available yet because text delivery jobs are not connected."
        : "Sending is not available yet because the text delivery system is still being prepared.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
