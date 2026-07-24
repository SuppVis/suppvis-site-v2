import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import { renderAdminCampaignEmail } from "@/app/lib/server/messages/admin-campaign";
import {
  getEmailCampaign,
  markEmailCampaignEmailPreviewGenerated,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import { adminCampaignPreviewSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-preview",
      limit: 60,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const body = await readJsonBody(request);
    const submission = adminCampaignPreviewSchema.parse(body);
    let campaignPreviewUpdate:
      | Awaited<ReturnType<typeof markEmailCampaignEmailPreviewGenerated>>
      | null = null;

    if (submission.campaignId || submission.expectedVersion) {
      if (!submission.campaignId || !submission.expectedVersion) {
        throw new PublicApiError(
          400,
          "preview_campaign_required",
          "Save the email before generating its preview.",
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
        campaign.body !== submission.body ||
        campaign.cta_label !== submission.ctaLabel ||
        campaign.cta_url !== submission.ctaUrl ||
        campaign.heading !== submission.heading ||
        campaign.message_type !== submission.messageType ||
        campaign.subject !== submission.subject
      ) {
        throw new PublicApiError(
          409,
          "email_draft_not_saved",
          "Save the current email before generating its preview.",
        );
      }

      const draftVersion = campaign.email_draft_version || campaign.version;
      campaignPreviewUpdate = await markEmailCampaignEmailPreviewGenerated({
        draftVersion,
        expectedVersion: campaign.version,
        id: campaign.id,
        now: new Date().toISOString(),
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

    const rendered = renderAdminCampaignEmail({
      body: submission.body,
      ctaLabel: submission.ctaLabel,
      ctaUrl: submission.ctaUrl,
      heading: submission.heading,
      messageType: submission.messageType,
      subject: submission.subject,
    });

    await recordAdminCampaignAudit({
      action: "preview_generated",
      adminIdentifier: admin.identifier,
    });

    return NextResponse.json({
      ok: true,
      preview: rendered,
      campaign: campaignPreviewUpdate
        ? {
            id: campaignPreviewUpdate.id,
            updatedAt: campaignPreviewUpdate.updated_at,
            version: campaignPreviewUpdate.version,
            emailPreviewGeneratedAt:
              campaignPreviewUpdate.email_preview_generated_at,
            emailPreviewVersion: campaignPreviewUpdate.email_preview_version,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
