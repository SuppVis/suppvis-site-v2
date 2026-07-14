import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  getEmailCampaign,
  listEmailCampaignRecipients,
} from "@/app/lib/server/persistence";
import { enforceRateLimit } from "@/app/lib/server/request";
import { adminCampaignIdSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = new Set(["queueing", "queued", "sending"]);

function zeroCounts() {
  return {
    bounced: 0,
    complained: 0,
    delayed: 0,
    delivered: 0,
    failed: 0,
    queued: 0,
    rejected: 0,
    sending: 0,
    sent: 0,
    skipped: 0,
    total: 0,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-progress",
      limit: 120,
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
        "Email draft was not found.",
      );
    }

    const counts = zeroCounts();
    const recipients = await listEmailCampaignRecipients(id);

    for (const recipient of recipients) {
      counts.total += 1;

      if (recipient.status === "queueing") {
        counts.queued += 1;
      } else if (recipient.status === "delivery_delayed") {
        counts.delayed += 1;
      } else if (recipient.status in counts) {
        counts[recipient.status as keyof typeof counts] += 1;
      }
    }

    const response = NextResponse.json({
      ok: true,
      progress: {
        campaignStatus: campaign.status,
        completedAt: campaign.completed_at,
        eligible: campaign.eligible_count || 0,
        excluded: campaign.excluded_count || 0,
        isActive: ACTIVE_STATUSES.has(campaign.status),
        counts,
        updatedAt: campaign.updated_at,
      },
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
