import { ServerConfigError } from "@/app/lib/server/errors";

export function areAdminSmsAnnouncementsEnabled() {
  return process.env.ADMIN_SMS_ANNOUNCEMENTS_ENABLED === "true";
}

export function isAdminSmsTestSendEnabled() {
  return process.env.ADMIN_SMS_TEST_SEND_ENABLED === "true";
}

export function isAdminSmsBulkSendEnabled() {
  return process.env.ADMIN_SMS_BULK_SEND_ENABLED === "true";
}

export function isAdminSmsBulkInfraReady() {
  return process.env.ADMIN_SMS_BULK_SEND_INFRA_READY === "true";
}

export function assertAdminSmsTestTwilioConfigured() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL?.trim();
  const webhookSignatureRequired =
    process.env.TWILIO_WEBHOOK_SIGNATURE_REQUIRED?.trim();

  if (!accountSid?.startsWith("AC")) {
    throw new ServerConfigError("Twilio SMS test configuration is incomplete.");
  }

  if (!authToken) {
    throw new ServerConfigError("Twilio SMS test configuration is incomplete.");
  }

  if (!messagingServiceSid?.startsWith("MG")) {
    throw new ServerConfigError("Twilio SMS test configuration is incomplete.");
  }

  if (!statusCallbackUrl) {
    throw new ServerConfigError("Twilio SMS test configuration is incomplete.");
  }

  try {
    const parsed = new URL(statusCallbackUrl);
    if (parsed.protocol !== "https:") {
      throw new ServerConfigError("Twilio SMS test configuration is incomplete.");
    }
  } catch {
    throw new ServerConfigError("Twilio SMS test configuration is incomplete.");
  }

  if (process.env.NODE_ENV === "production" && webhookSignatureRequired !== "true") {
    throw new ServerConfigError("Twilio SMS test configuration is incomplete.");
  }
}
