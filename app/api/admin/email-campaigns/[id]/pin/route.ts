import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import { setEmailCampaignPinned } from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  adminCampaignIdSchema,
  adminCampaignPinSchema,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-pin",
      limit: 30,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const body = await readJsonBody(request);
    const submission = adminCampaignPinSchema.parse(body);
    const result = await setEmailCampaignPinned({
      id,
      expectedVersion: submission.expectedVersion,
      pinned: submission.pinned,
      now: new Date().toISOString(),
      updated_by: admin.identifier,
    });

    if (result.status === "pin_limit") {
      throw new PublicApiError(
        409,
        "pin_limit_reached",
        "You can pin up to 5 announcements. Unpin one before pinning another.",
      );
    }

    if (result.status === "conflict" || !result.record) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This announcement changed in another session. Reload it and try again.",
      );
    }

    await recordAdminCampaignAudit({
      action: submission.pinned ? "announcement_pinned" : "announcement_unpinned",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: submission.pinned ? "pinned" : "unpinned",
    });

    return NextResponse.json({
      ok: true,
      campaign: {
        id: result.record.id,
        status: result.record.status,
        updatedAt: result.record.updated_at,
        version: result.record.version,
        isPinned: result.record.is_pinned || false,
        pinnedAt: result.record.pinned_at || null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
