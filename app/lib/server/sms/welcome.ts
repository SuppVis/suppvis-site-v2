import {
  getSmsConfirmationTemplate,
  isWelcomeSmsEnabled,
} from "../messages/welcome";
import {
  canSendSmsToSubscriber,
  recordSmsSendAccepted,
  recordSmsSendFailure,
  type SmsSubscriberRecord,
} from "../persistence";
import { buildSmsStatusCallbackUrl, sendTwilioSms } from "./twilio";
import { getSmsConsentCategory } from "@/app/lib/smsConsent";

type SmsSubscriber = Pick<
  SmsSubscriberRecord,
  | "id"
  | "phone_number_e164"
  | "sms_global_opt_out"
  | "sms_informational_consent"
  | "sms_marketing_consent"
  | "status"
  | "welcome_sms_message_sid"
>;

export type WelcomeSmsSendResult =
  | {
      ok: true;
      status: "disabled";
      reason: "welcome_sms_disabled";
    }
  | {
      ok: true;
      status: "skipped";
      reason:
        | "already_sent"
        | "duplicate_beta_application"
        | "invalid_phone"
        | "missing_sms_consent"
        | "missing_subscriber"
        | "subscriber_suppressed";
    }
  | {
      ok: true;
      status: "sent";
      messageSid: string;
    }
  | {
      ok: false;
      status: "failed";
      errorCode?: string;
    };

function subscriberLogContext(subscriber?: SmsSubscriber | null) {
  return {
    subscriberId: subscriber?.id,
  };
}

function safeTwilioErrorCode(error: unknown) {
  const code = (error as { code?: unknown }).code;

  return typeof code === "string" || typeof code === "number"
    ? String(code)
    : undefined;
}

function safeTwilioErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : undefined;

  if (!message) {
    return undefined;
  }

  return message
    .replace(/\+\d{7,15}/g, "[phone]")
    .replace(/\bAC[a-fA-F0-9]{32}\b/g, "[account]")
    .replace(/\bMG[a-fA-F0-9]{32}\b/g, "[messaging_service]")
    .slice(0, 240);
}

function isValidE164(phone: string | undefined) {
  return Boolean(phone && /^\+\d{8,15}$/.test(phone));
}

export async function sendWelcomeSms(input: {
  firstName: string;
  shouldSendWelcomeSms: boolean;
  subscriber: SmsSubscriber | null | undefined;
}): Promise<WelcomeSmsSendResult> {
  console.info("[sms] welcome send attempt", {
    ...subscriberLogContext(input.subscriber),
    enabled: isWelcomeSmsEnabled(),
    shouldSendWelcomeSms: input.shouldSendWelcomeSms,
    subscriberStatus: input.subscriber?.status,
  });

  if (!input.shouldSendWelcomeSms) {
    console.info("[sms] welcome send skipped", {
      ...subscriberLogContext(input.subscriber),
      reason: "duplicate_beta_application",
    });

    return {
      ok: true,
      status: "skipped",
      reason: "duplicate_beta_application",
    };
  }

  if (!isWelcomeSmsEnabled()) {
    console.info("[sms] welcome send disabled", {
      ...subscriberLogContext(input.subscriber),
      reason: "welcome_sms_disabled",
    });

    return {
      ok: true,
      status: "disabled",
      reason: "welcome_sms_disabled",
    };
  }

  if (!input.subscriber) {
    console.info("[sms] welcome send skipped", {
      reason: "missing_subscriber",
    });

    return {
      ok: true,
      status: "skipped",
      reason: "missing_subscriber",
    };
  }

  const consentCategory = getSmsConsentCategory({
    informational: input.subscriber.sms_informational_consent,
    marketing: input.subscriber.sms_marketing_consent,
  });

  if (!consentCategory) {
    console.info("[sms] welcome send skipped", {
      ...subscriberLogContext(input.subscriber),
      reason: "missing_sms_consent",
    });

    return {
      ok: true,
      status: "skipped",
      reason: "missing_sms_consent",
    };
  }

  if (!isValidE164(input.subscriber.phone_number_e164)) {
    console.info("[sms] welcome send skipped", {
      ...subscriberLogContext(input.subscriber),
      reason: "invalid_phone",
    });

    return {
      ok: true,
      status: "skipped",
      reason: "invalid_phone",
    };
  }

  if (!canSendSmsToSubscriber(input.subscriber, consentCategory)) {
    console.info("[sms] welcome send skipped", {
      ...subscriberLogContext(input.subscriber),
      reason: "subscriber_suppressed",
      subscriberStatus: input.subscriber.status,
    });

    return {
      ok: true,
      status: "skipped",
      reason: "subscriber_suppressed",
    };
  }

  if (input.subscriber.welcome_sms_message_sid) {
    console.info("[sms] welcome send skipped", {
      ...subscriberLogContext(input.subscriber),
      reason: "already_sent",
    });

    return {
      ok: true,
      status: "skipped",
      reason: "already_sent",
    };
  }

  try {
    const messageType = "sms_informational_confirmation";
    const statusCallbackUrl = buildSmsStatusCallbackUrl({
      messageType,
      subscriberId: input.subscriber.id,
    });
    const sendResult = await sendTwilioSms({
      body: getSmsConfirmationTemplate(consentCategory, {
        firstName: input.firstName,
      }),
      statusCallbackUrl,
      to: input.subscriber.phone_number_e164,
    });
    const now = new Date().toISOString();

    await recordSmsSendAccepted({
      id: input.subscriber.id,
      messageSid: sendResult.messageSid,
      messageType,
      now,
    });

    console.info("[sms] twilio accepted", {
      ...subscriberLogContext(input.subscriber),
      messageSid: sendResult.messageSid,
      providerStatus: sendResult.status,
    });

    return {
      ok: true,
      status: "sent",
      messageSid: sendResult.messageSid,
    };
  } catch (error) {
    const errorCode = safeTwilioErrorCode(error);
    const errorMessageSafe = safeTwilioErrorMessage(error);

    console.error("[sms] welcome send failed", {
      ...subscriberLogContext(input.subscriber),
      errorCode,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    try {
      await recordSmsSendFailure({
        id: input.subscriber.id,
        errorCode,
        errorMessageSafe,
        now: new Date().toISOString(),
      });
    } catch (trackingError) {
      console.error("[sms] failure tracking failed", {
        ...subscriberLogContext(input.subscriber),
        errorName:
          trackingError instanceof Error ? trackingError.name : "UnknownError",
      });
    }

    return {
      ok: false,
      status: "failed",
      errorCode,
    };
  }
}
