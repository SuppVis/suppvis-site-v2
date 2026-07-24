import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { buildCampaignAudience } from "@/app/lib/server/email/campaign-audience";
import {
  hasCurrentAdminTests,
  hasCurrentEmailPreview,
  hasCurrentSmsPreview,
  hasSavedSmsDraft,
} from "@/app/lib/server/email/campaign-readiness";
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

    if (!hasCurrentEmailPreview(campaign)) {
      throw new PublicApiError(
        409,
        "email_preview_required",
        campaign.email_preview_generated_at
          ? "The email preview is out of date. Generate it again."
          : "Generate the email preview before reviewing recipients.",
      );
    }

    if (!hasSavedSmsDraft(campaign)) {
      throw new PublicApiError(
        409,
        "sms_draft_not_saved",
        "Save the text message before reviewing recipients.",
      );
    }

    if (!hasCurrentSmsPreview(campaign)) {
      throw new PublicApiError(
        409,
        "sms_preview_required",
        campaign.sms_preview_generated_at
          ? "The text preview is out of date. Generate it again."
          : "Generate the text preview before reviewing recipients.",
      );
    }

    if (!hasCurrentAdminTests(campaign)) {
      throw new PublicApiError(
        409,
        "campaign_not_ready",
        "Complete both admin tests before reviewing recipients.",
      );
    }

    const emailAudience = await buildCampaignAudience();
    const smsAudience = await buildSmsCampaignAudience();

    await recordAdminCampaignAudit({
      action: "recipient_count_generated",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: `email=${emailAudience.eligibleCount} sms=${smsAudience.eligibleCount}`,
    });

    const confirmationPhrase = `SEND EMAIL TO ${emailAudience.eligibleCount} AND TEXT TO ${smsAudience.eligibleCount}`;

    return NextResponse.json({
      ok: true,
      audience: {
        eligibleCount: emailAudience.eligibleCount,
        excludedCount: emailAudience.excludedCount,
        duplicateCount: emailAudience.duplicateCount,
        smsEligibleCount: smsAudience.eligibleCount,
        smsExcludedCount: smsAudience.excludedCount,
        smsDuplicateCount: smsAudience.duplicateCount,
        smsIncluded: true,
        receivingBothCount: null,
        confirmationPhrase,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
