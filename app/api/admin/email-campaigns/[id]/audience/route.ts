import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { buildCampaignAudience } from "@/app/lib/server/email/campaign-audience";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import { getEmailCampaign } from "@/app/lib/server/persistence";
import { enforceRateLimit } from "@/app/lib/server/request";
import { buildSmsCampaignAudience } from "@/app/lib/server/sms/campaign-audience";
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
        "Email draft was not found.",
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
        "Send a test email before reviewing recipients.",
      );
    }

    const emailAudience = await buildCampaignAudience();
    const smsAudience = campaign.sms_enabled
      ? await buildSmsCampaignAudience()
      : null;

    await recordAdminCampaignAudit({
      action: "recipient_count_generated",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: smsAudience
        ? `email=${emailAudience.eligibleCount} sms=${smsAudience.eligibleCount}`
        : `eligible=${emailAudience.eligibleCount} excluded=${emailAudience.excludedCount}`,
    });

    const confirmationPhrase = smsAudience
      ? `SEND EMAIL TO ${emailAudience.eligibleCount} AND TEXT TO ${smsAudience.eligibleCount}`
      : `SEND TO ${emailAudience.eligibleCount} SUBSCRIBERS`;

    return NextResponse.json({
      ok: true,
      audience: {
        eligibleCount: emailAudience.eligibleCount,
        excludedCount: emailAudience.excludedCount,
        duplicateCount: emailAudience.duplicateCount,
        smsEligibleCount: smsAudience?.eligibleCount || 0,
        smsExcludedCount: smsAudience?.excludedCount || 0,
        smsDuplicateCount: smsAudience?.duplicateCount || 0,
        smsIncluded: Boolean(smsAudience),
        receivingBothCount: null,
        confirmationPhrase,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
