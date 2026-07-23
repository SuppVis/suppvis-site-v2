import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import { getEmailCampaign } from "@/app/lib/server/persistence";
import {
  areAdminSmsAnnouncementsEnabled,
  isAdminSmsTestSendEnabled,
} from "@/app/lib/server/sms/admin-campaign";
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
      scope: "admin-sms-campaign-test-send",
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
        "Announcement draft was not found.",
      );
    }

    if (!campaign.sms_enabled) {
      throw new PublicApiError(
        400,
        "sms_not_included",
        "This announcement does not include a text message.",
      );
    }

    await recordAdminCampaignAudit({
      action: "sms_test_send_blocked",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status:
        areAdminSmsAnnouncementsEnabled() && isAdminSmsTestSendEnabled()
          ? "missing_verified_admin_test_number"
          : "feature_flags_disabled",
    }).catch((auditError) => {
      console.error("[admin-sms] blocked test audit failed", {
        campaignId: id,
        errorName: auditError instanceof Error ? auditError.name : "UnknownError",
      });
    });

    return NextResponse.json({
      ok: true,
      status: "disabled",
      code: "sms_test_send_disabled",
      message:
        "A verified admin test number is required before text testing is available.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
