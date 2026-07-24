import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import {
  adminEmailFromIdentifier,
  requireAdminSession,
} from "@/app/lib/server/admin-session";
import {
  areAdminCampaignsEnabled,
  classifyAdminCampaignSendError,
  isAdminEmailTestSendEnabled,
  sendAdminCampaignTestEmail,
} from "@/app/lib/server/email/admin-campaign";
import {
  emailDraftVersion,
  hasCurrentEmailPreview,
} from "@/app/lib/server/email/campaign-readiness";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import { renderAdminCampaignEmail } from "@/app/lib/server/messages/admin-campaign";
import {
  getEmailCampaign,
  markEmailCampaignTestFailed,
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
        "Email draft was not found.",
      );
    }

    const adminEmail = adminEmailFromIdentifier(admin.identifier);

    if (!hasCurrentEmailPreview(campaign)) {
      throw new PublicApiError(
        409,
        "email_preview_required",
        campaign.email_preview_generated_at
          ? "The preview is out of date. Generate it again."
          : "Generate the email preview before sending a test.",
      );
    }

    if (!areAdminCampaignsEnabled() || !isAdminEmailTestSendEnabled()) {
      await recordAdminCampaignAudit({
        action: "test_send_blocked",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: "feature_flags_disabled",
      }).catch((auditError) => {
        console.error("[admin-email] blocked test audit failed", {
          campaignId: id,
          errorName:
            auditError instanceof Error ? auditError.name : "UnknownError",
        });
      });

      return NextResponse.json({
        ok: true,
        status: "disabled",
        code: "test_send_disabled",
        message:
          "Test email sending is disabled.",
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
      messageType: campaign.message_type,
      subject: campaign.subject,
    });
    let result: Awaited<ReturnType<typeof sendAdminCampaignTestEmail>>;

    try {
      result = await sendAdminCampaignTestEmail({
        adminIdentifier: admin.identifier,
        campaignId: id,
        content: rendered,
        recipientEmail: adminEmail,
      });
    } catch (error) {
      const sendError = classifyAdminCampaignSendError(error);

      console.error("[admin-email] test send failed", {
        campaignId: id,
        errorCode: sendError.code,
        errorName: sendError.logCode,
      });

      await markEmailCampaignTestFailed({
        errorCode: sendError.code,
        expectedVersion: reserved.version,
        id,
        now: new Date().toISOString(),
        updated_by: admin.identifier,
      }).catch((updateError) => {
        console.error("[admin-email] test failure tracking failed", {
          campaignId: id,
          errorName:
            updateError instanceof Error ? updateError.name : "UnknownError",
        });
      });

      await recordAdminCampaignAudit({
        action: "test_send_failed",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: sendError.code,
      }).catch((auditError) => {
        console.error("[admin-email] test failure audit failed", {
          campaignId: id,
          errorName:
            auditError instanceof Error ? auditError.name : "UnknownError",
        });
      });

      throw new PublicApiError(
        sendError.status,
        sendError.code,
        sendError.message,
      );
    }

    const updated = await markEmailCampaignTestSent({
      draftVersion: emailDraftVersion(campaign),
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
    }).catch((auditError) => {
      console.error("[admin-email] test send audit failed", {
        campaignId: id,
        errorName: auditError instanceof Error ? auditError.name : "UnknownError",
      });
    });

    return NextResponse.json({
      ok: true,
      status: "sent",
      messageId: result.messageId,
      campaign: {
        id: updated.id,
        status: updated.status,
        version: updated.version,
        emailDraftVersion: updated.email_draft_version || updated.version,
        emailPreviewGeneratedAt: updated.email_preview_generated_at || null,
        emailPreviewVersion: updated.email_preview_version || 0,
        testedAt: updated.tested_at,
        emailTestVersion: updated.email_test_version || 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
