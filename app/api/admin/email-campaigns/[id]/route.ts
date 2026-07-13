import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  getEmailCampaign,
  updateEmailCampaignDraft,
  type EmailCampaignRecord,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  adminCampaignIdSchema,
  updateAdminCampaignSchema,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function campaignResponse(record: EmailCampaignRecord) {
  return {
    id: record.id,
    messageType: record.message_type,
    subject: record.subject,
    heading: record.heading,
    body: record.body,
    ctaLabel: record.cta_label,
    ctaUrl: record.cta_url,
    status: record.status,
    createdBy: record.created_by,
    updatedBy: record.updated_by,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    version: record.version,
    testedAt: record.tested_at,
    approvedAt: record.approved_at,
    sentAt: record.sent_at,
    testRecipient: record.test_recipient,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-load",
      limit: 80,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const campaign = await getEmailCampaign(id);

    if (!campaign) {
      throw new PublicApiError(
        404,
        "campaign_not_found",
        "Campaign draft was not found.",
      );
    }

    return NextResponse.json({
      ok: true,
      campaign: campaignResponse(campaign),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-update",
      limit: 40,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const body = await readJsonBody(request);
    const submission = updateAdminCampaignSchema.parse(body);
    const now = new Date().toISOString();

    const updated = await updateEmailCampaignDraft({
      id,
      body: submission.body,
      cta_label: submission.ctaLabel,
      cta_url: submission.ctaUrl,
      expectedVersion: submission.expectedVersion,
      heading: submission.heading,
      message_type: submission.messageType,
      now,
      subject: submission.subject,
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
      action: "draft_updated",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: updated.status,
    });

    return NextResponse.json({
      ok: true,
      campaign: campaignResponse(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
