import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  approveEmailCampaign,
  getEmailCampaign,
  type EmailCampaignRecord,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  adminCampaignIdSchema,
  adminCampaignVersionSchema,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function campaignResponse(record: EmailCampaignRecord) {
  return {
    id: record.id,
    status: record.status,
    version: record.version,
    approvedAt: record.approved_at,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-approve",
      limit: 15,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const body = await readJsonBody(request);
    const submission = adminCampaignVersionSchema.parse(body);
    const current = await getEmailCampaign(id);

    if (!current) {
      throw new PublicApiError(
        404,
        "campaign_not_found",
        "Email draft was not found.",
      );
    }

    if (current.status !== "tested") {
      throw new PublicApiError(
        409,
        "campaign_not_tested",
        "Send a test email before approving this announcement.",
      );
    }

    if (
      !current.sms_enabled ||
      !current.sms_saved_at ||
      !current.sms_body ||
      !current.sms_rendered_body
    ) {
      throw new PublicApiError(
        409,
        "sms_draft_not_saved",
        "Save the text message before approving this announcement.",
      );
    }

    const approved = await approveEmailCampaign({
      id,
      expectedVersion: submission.expectedVersion,
      now: new Date().toISOString(),
      approved_by: admin.identifier,
    });

    if (!approved) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This email changed in another session. Reload it and try again.",
      );
    }

    await recordAdminCampaignAudit({
      action: "campaign_approved",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: "approved email+text",
    });

    return NextResponse.json({
      ok: true,
      campaign: campaignResponse(approved),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
