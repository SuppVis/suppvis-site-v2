import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { buildCampaignAudience } from "@/app/lib/server/email/campaign-audience";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import { getEmailCampaign } from "@/app/lib/server/persistence";
import { enforceRateLimit } from "@/app/lib/server/request";
import { adminCampaignIdSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-campaign-audience",
      limit: 20,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const campaign = await getEmailCampaign(id);

    if (!campaign) {
      throw new PublicApiError(
        404,
        "campaign_not_found",
        "Campaign draft was not found.",
      );
    }

    if (
      campaign.status !== "tested" &&
      campaign.status !== "approved" &&
      campaign.status !== "queued" &&
      campaign.status !== "sending"
    ) {
      throw new PublicApiError(
        409,
        "campaign_not_ready",
        "Send a test email before calculating the production audience.",
      );
    }

    const audience = await buildCampaignAudience();

    await recordAdminCampaignAudit({
      action: "recipient_count_generated",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: `eligible=${audience.eligibleCount} excluded=${audience.excludedCount}`,
    });

    return NextResponse.json({
      ok: true,
      audience: {
        eligibleCount: audience.eligibleCount,
        excludedCount: audience.excludedCount,
        duplicateCount: audience.duplicateCount,
        confirmationPhrase: `SEND TO ${audience.eligibleCount} SUBSCRIBERS`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
