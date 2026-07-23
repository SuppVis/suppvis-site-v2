import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError } from "@/app/lib/server/errors";
import { renderAdminSmsAnnouncement } from "@/app/lib/server/messages/admin-sms";
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

    await recordAdminCampaignAudit({
      action: "sms_preview_generated",
      adminIdentifier: admin.identifier,
      status: `segments=${rendered.segmentCount} encoding=${rendered.encoding}`,
    });

    return NextResponse.json({
      ok: true,
      preview: rendered,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
