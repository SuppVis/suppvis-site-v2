import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { areAdminCampaignsEnabled } from "@/app/lib/server/email/admin-campaign";
import {
  hasCurrentEmailTest,
  hasCurrentSmsPreview,
} from "@/app/lib/server/email/campaign-readiness";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import { getEmailCampaign } from "@/app/lib/server/persistence";
import { enforceRateLimit } from "@/app/lib/server/request";
import {
  getAdminSmsTestRecipientForEmail,
} from "@/app/lib/server/sms/admin-test-recipients";
import {
  assertAdminSmsTestTwilioConfigured,
  isAdminSmsTestSendEnabled,
} from "@/app/lib/server/sms/admin-campaign";
import { adminCampaignIdSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseExpectedVersion(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("expectedVersion");

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-sms-campaign-test-readiness",
      limit: 80,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const admin = await requireAdminSession();
    const id = adminCampaignIdSchema.parse(params.id);
    const expectedVersion = parseExpectedVersion(request);
    const campaign = await getEmailCampaign(id);

    if (!campaign) {
      throw new PublicApiError(
        404,
        "campaign_not_found",
        "Announcement draft was not found.",
      );
    }

    const textSaved = Boolean(
      campaign.sms_enabled &&
        campaign.sms_saved_at &&
        campaign.sms_rendered_body,
    );
    const versionMatches =
      expectedVersion === null || campaign.version === expectedVersion;
    const emailTestCurrent = hasCurrentEmailTest(campaign);
    const smsPreviewCurrent = hasCurrentSmsPreview(campaign);
    const adminCampaignsEnabled = areAdminCampaignsEnabled();
    const smsTestEnabled = isAdminSmsTestSendEnabled();

    let mappingConfigValid = true;
    let maskedPhone: string | null = null;
    let mappingFound = false;

    try {
      const recipient = getAdminSmsTestRecipientForEmail(admin.email);
      mappingFound = Boolean(recipient);
      maskedPhone = recipient?.maskedPhone || null;
    } catch {
      mappingConfigValid = false;
    }

    let twilioConfigured = true;

    try {
      assertAdminSmsTestTwilioConfigured();
    } catch {
      twilioConfigured = false;
    }

    const ready =
      adminCampaignsEnabled &&
      smsTestEnabled &&
      mappingConfigValid &&
      mappingFound &&
      textSaved &&
      versionMatches &&
      emailTestCurrent &&
      smsPreviewCurrent &&
      twilioConfigured;

    const reason = !textSaved
      ? "text_not_saved"
      : !versionMatches
        ? "stale_version"
        : !emailTestCurrent
          ? "email_test_required"
          : !smsPreviewCurrent
            ? "sms_preview_required"
            : !adminCampaignsEnabled
              ? "admin_campaigns_disabled"
              : !smsTestEnabled
                ? "sms_test_disabled"
                : !mappingConfigValid
                  ? "mapping_invalid"
                  : !mappingFound
                    ? "mapping_missing"
                    : !twilioConfigured
                      ? "twilio_config_incomplete"
                      : "ready";

    return NextResponse.json(
      {
        ok: true,
        readiness: {
          adminCampaignsEnabled,
          featureEnabled: smsTestEnabled,
          mappingConfigValid,
          mappingFound,
          maskedPhone,
          phoneValid: mappingFound,
          ready,
          reason,
          sessionAuthorized: true,
          emailTestCurrent,
          smsPreviewCurrent,
          textSaved,
          twilioConfigured,
          versionMatches,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
