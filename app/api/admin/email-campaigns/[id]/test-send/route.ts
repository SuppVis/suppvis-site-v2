import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import {
  adminEmailFromIdentifier,
  requireAdminSession,
} from "@/app/lib/server/admin-session";
import {
  areAdminCampaignsEnabled,
  isAdminEmailTestSendEnabled,
  sendAdminCampaignTestEmail,
} from "@/app/lib/server/email/admin-campaign";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import { renderAdminCampaignEmail } from "@/app/lib/server/messages/admin-campaign";
import {
  getEmailCampaign,
  markEmailCampaignTestReady,
  markEmailCampaignTestSent,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  adminCampaignIdSchema,
  adminCampaignTestSendSchema,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-test-send",
      limit: 10,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const body = await readJsonBody(request);
    adminCampaignTestSendSchema.parse(body);
    const campaign = await getEmailCampaign(id);

    if (!campaign) {
      throw new PublicApiError(
        404,
        "campaign_not_found",
        "Campaign draft was not found.",
      );
    }

    const adminEmail = adminEmailFromIdentifier(admin.identifier);

    if (!areAdminCampaignsEnabled() || !isAdminEmailTestSendEnabled()) {
      await recordAdminCampaignAudit({
        action: "test_send_blocked",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: "feature_flags_disabled",
      });

      return NextResponse.json({
        ok: true,
        status: "disabled",
        code: "test_send_disabled",
        message:
          "Test sending is disabled until ADMIN_EMAIL_CAMPAIGNS_ENABLED and ADMIN_EMAIL_TEST_SEND_ENABLED are true.",
      });
    }

    const reserved = await markEmailCampaignTestReady({
      id,
      expectedVersion: campaign.version,
      now: new Date().toISOString(),
      test_recipient: adminEmail,
      updated_by: admin.identifier,
    });

    if (!reserved) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This draft changed in another session. Reload it and try again.",
      );
    }

    const rendered = renderAdminCampaignEmail({
      body: campaign.body,
      ctaLabel: campaign.cta_label,
      ctaUrl: campaign.cta_url,
      heading: campaign.heading,
      subject: campaign.subject,
    });
    const result = await sendAdminCampaignTestEmail({
      adminIdentifier: admin.identifier,
      campaignId: id,
      content: rendered,
      recipientEmail: adminEmail,
    });
    const updated = await markEmailCampaignTestSent({
      id,
      expectedVersion: reserved.version,
      messageId: result.messageId,
      now: new Date().toISOString(),
      test_recipient: adminEmail,
      updated_by: admin.identifier,
    });

    if (!updated) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This draft changed in another session. Reload it and try again.",
      );
    }

    await recordAdminCampaignAudit({
      action: "test_send_sent",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: "tested",
    });

    return NextResponse.json({
      ok: true,
      status: "sent",
      messageId: result.messageId,
      campaign: {
        id: updated.id,
        status: updated.status,
        version: updated.version,
        testedAt: updated.tested_at,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
