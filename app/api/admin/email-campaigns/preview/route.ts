import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError } from "@/app/lib/server/errors";
import { renderAdminCampaignEmail } from "@/app/lib/server/messages/admin-campaign";
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
    });
  } catch (error) {
    return handleApiError(error);
  }
}
