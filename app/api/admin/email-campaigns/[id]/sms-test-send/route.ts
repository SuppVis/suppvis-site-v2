import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { recordAdminCampaignAudit } from "@/app/lib/server/admin-campaign-audit";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import {
  handleApiError,
  PublicApiError,
  ServerConfigError,
} from "@/app/lib/server/errors";
import { areAdminCampaignsEnabled } from "@/app/lib/server/email/admin-campaign";
import {
  getEmailCampaign,
  markEmailCampaignSmsTestFailed,
  markEmailCampaignSmsTestSent,
  reserveEmailCampaignSmsTest,
} from "@/app/lib/server/persistence";
import {
  getAdminSmsTestRecipientForEmail,
  maskAdminSmsTestPhone,
} from "@/app/lib/server/sms/admin-test-recipients";
import {
  assertAdminSmsTestTwilioConfigured,
  areAdminSmsAnnouncementsEnabled,
  isAdminSmsTestSendEnabled,
} from "@/app/lib/server/sms/admin-campaign";
import { sendTwilioSms } from "@/app/lib/server/sms/twilio";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  adminCampaignIdSchema,
  adminCampaignSmsTestSendSchema,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeTwilioErrorCode(error: unknown) {
  const code = (error as { code?: unknown }).code;

  return typeof code === "string" || typeof code === "number"
    ? String(code)
    : "twilio_send_failed";
}

function safeTwilioErrorMessage(error: unknown) {
  if (error instanceof ServerConfigError) {
    return "Text testing is not ready yet.";
  }

  const status = (error as { status?: unknown }).status;

  if (typeof status === "number" && status >= 400 && status < 500) {
    return "Twilio rejected the test message.";
  }

  return "The test text could not be sent right now.";
}

function buildAdminSmsTestStatusCallbackUrl(campaignId: string) {
  const callbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL?.trim();

  if (!callbackUrl) {
    throw new ServerConfigError(
      "Missing required environment variable: TWILIO_STATUS_CALLBACK_URL",
    );
  }

  const url = new URL(callbackUrl);
  url.searchParams.set("message_type", "admin_campaign_sms_test");
  url.searchParams.set("campaign", campaignId);

  return url.toString();
}

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
    const submission = adminCampaignSmsTestSendSchema.parse(body);
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

    if (!campaign.sms_saved_at || !campaign.sms_rendered_body) {
      throw new PublicApiError(
        409,
        "sms_draft_not_saved",
        "Save the email and text before sending a test text.",
      );
    }

    if (campaign.version !== submission.expectedVersion) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This announcement changed in another session. Reload it and try again.",
      );
    }

    if (
      !areAdminCampaignsEnabled() ||
      !areAdminSmsAnnouncementsEnabled() ||
      !isAdminSmsTestSendEnabled()
    ) {
      await recordAdminCampaignAudit({
        action: "sms_test_send_blocked",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: "feature_flags_disabled",
      }).catch((auditError) => {
        console.error("[admin-sms] blocked test audit failed", {
          campaignId: id,
          errorName:
            auditError instanceof Error ? auditError.name : "UnknownError",
        });
      });

      return NextResponse.json({
        ok: true,
        status: "disabled",
        code: "sms_test_send_disabled",
        message: "Text testing is not enabled.",
      });
    }

    const testRecipient = getAdminSmsTestRecipientForEmail(admin.email);

    if (!testRecipient) {
      await recordAdminCampaignAudit({
        action: "sms_test_send_blocked",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: "admin_test_recipient_missing",
      }).catch((auditError) => {
        console.error("[admin-sms] missing recipient audit failed", {
          campaignId: id,
          errorName:
            auditError instanceof Error ? auditError.name : "UnknownError",
        });
      });

      throw new PublicApiError(
        403,
        "admin_sms_test_recipient_missing",
        "No test number is configured for this admin.",
      );
    }

    try {
      assertAdminSmsTestTwilioConfigured();
    } catch (error) {
      console.error("[admin-sms] test send configuration unavailable", {
        campaignId: id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });

      await recordAdminCampaignAudit({
        action: "sms_test_send_blocked",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: "twilio_configuration_incomplete",
      }).catch((auditError) => {
        console.error("[admin-sms] config audit failed", {
          campaignId: id,
          errorName:
            auditError instanceof Error ? auditError.name : "UnknownError",
        });
      });

      throw new PublicApiError(
        503,
        "sms_test_configuration_problem",
        "Text testing is not ready yet.",
      );
    }

    const attemptId = randomUUID();
    const maskedPhone = maskAdminSmsTestPhone(testRecipient.phoneE164);
    const reserved = await reserveEmailCampaignSmsTest({
      id,
      expectedVersion: campaign.version,
      now: new Date().toISOString(),
      test_attempt_id: attemptId,
      test_recipient_id: testRecipient.recipientId,
      test_recipient_masked: maskedPhone,
      updated_by: admin.identifier,
    });

    if (!reserved) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This announcement changed in another session. Reload it and try again.",
      );
    }

    let sendResult: Awaited<ReturnType<typeof sendTwilioSms>>;

    try {
      sendResult = await sendTwilioSms({
        body: campaign.sms_rendered_body,
        statusCallbackUrl: buildAdminSmsTestStatusCallbackUrl(id),
        to: testRecipient.phoneE164,
      });
    } catch (error) {
      const errorCode = safeTwilioErrorCode(error);

      console.error("[admin-sms] test send failed", {
        campaignId: id,
        errorCode,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });

      await markEmailCampaignSmsTestFailed({
        errorCode,
        expectedVersion: reserved.version,
        id,
        now: new Date().toISOString(),
        test_attempt_id: attemptId,
        updated_by: admin.identifier,
      }).catch((updateError) => {
        console.error("[admin-sms] test failure tracking failed", {
          campaignId: id,
          errorName:
            updateError instanceof Error ? updateError.name : "UnknownError",
        });
      });

      await recordAdminCampaignAudit({
        action: "sms_test_send_failed",
        adminIdentifier: admin.identifier,
        campaignId: id,
        status: errorCode,
      }).catch((auditError) => {
        console.error("[admin-sms] test failure audit failed", {
          campaignId: id,
          errorName:
            auditError instanceof Error ? auditError.name : "UnknownError",
        });
      });

      const failedCampaign = await getEmailCampaign(id);

      return NextResponse.json({
        ok: true,
        status: "failed",
        code: errorCode,
        message: safeTwilioErrorMessage(error),
        campaign: failedCampaign
          ? {
              id: failedCampaign.id,
              status: failedCampaign.status,
              version: failedCampaign.version,
              smsTestStatus: failedCampaign.sms_test_status || null,
            }
          : null,
      });
    }

    const updated = await markEmailCampaignSmsTestSent({
      id,
      expectedVersion: reserved.version,
      messageSid: sendResult.messageSid,
      now: new Date().toISOString(),
      providerStatus: sendResult.status,
      test_attempt_id: attemptId,
      test_recipient_id: testRecipient.recipientId,
      test_recipient_masked: maskedPhone,
      updated_by: admin.identifier,
    });

    if (!updated) {
      throw new PublicApiError(
        409,
        "campaign_conflict",
        "This announcement changed in another session. Reload it and try again.",
      );
    }

    await recordAdminCampaignAudit({
      action: "sms_test_send_sent",
      adminIdentifier: admin.identifier,
      campaignId: id,
      status: "tested",
    }).catch((auditError) => {
      console.error("[admin-sms] test send audit failed", {
        campaignId: id,
        errorName: auditError instanceof Error ? auditError.name : "UnknownError",
      });
    });

    return NextResponse.json({
      ok: true,
      status: "sent",
      messageSid: sendResult.messageSid,
      providerStatus: sendResult.status,
      maskedPhone,
      campaign: {
        id: updated.id,
        status: updated.status,
        version: updated.version,
        smsTestedAt: updated.sms_tested_at,
        smsTestMessageSid: updated.sms_test_message_sid,
        smsTestProviderStatus: updated.sms_test_provider_status,
        smsTestStatus: updated.sms_test_status,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
