import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import { renderAdminSmsAnnouncement } from "@/app/lib/server/messages/admin-sms";
import {
  getEmailCampaign,
  markEmailCampaignSmsPreviewGenerated,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import { adminCampaignSmsPreviewSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-sms-campaign-preview",
      limit: 80,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const body = await readJsonBody(request);
    const submission = adminCampaignSmsPreviewSchema.parse(body);
    const rendered = renderAdminSmsAnnouncement(submission.smsBody);
    let campaignPreviewUpdate:
      | Awaited<ReturnType<typeof markEmailCampaignSmsPreviewGenerated>>
      | null = null;

    if (submission.campaignId || submission.expectedVersion) {
      if (!submission.campaignId || !submission.expectedVersion) {
        throw new PublicApiError(
          400,
          "preview_campaign_required",
          "Save the text before generating its preview.",
        );
      }

      const campaign = await getEmailCampaign(submission.campaignId);

      if (!campaign) {
        throw new PublicApiError(
          404,
          "campaign_not_found",
          "Announcement draft was not found.",
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
        !campaign.sms_rendered_body ||
        campaign.sms_body !== rendered.editableBody
      ) {
        throw new PublicApiError(
          409,
          "sms_draft_not_saved",
          "Save the current text before generating its preview.",
        );
      }

      campaignPreviewUpdate = await markEmailCampaignSmsPreviewGenerated({
        expectedVersion: campaign.version,
        id: campaign.id,
        now: new Date().toISOString(),
        smsDraftVersion: campaign.sms_draft_version || campaign.version,
        updated_by: admin.identifier,
      });

      if (!campaignPreviewUpdate) {
        throw new PublicApiError(
          409,
          "campaign_conflict",
          "This announcement changed in another session. Reload it and try again.",
        );
      }
    }

    await recordAdminCampaignAudit({
      action: "sms_preview_generated",
      adminIdentifier: admin.identifier,
      status: `segments=${rendered.segmentCount} encoding=${rendered.encoding}`,
    });

    return NextResponse.json({
      ok: true,
      preview: rendered,
      campaign: campaignPreviewUpdate
        ? {
            id: campaignPreviewUpdate.id,
            updatedAt: campaignPreviewUpdate.updated_at,
            version: campaignPreviewUpdate.version,
            smsPreviewGeneratedAt:
              campaignPreviewUpdate.sms_preview_generated_at,
            smsPreviewVersion: campaignPreviewUpdate.sms_preview_version,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
