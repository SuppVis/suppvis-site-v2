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
  | "last_sms_status"
  | "sms_provider_status"
  | "status"
  | "welcome_sms_message_sid"
>;

type WelcomeSmsSkipReason =
  | "already_sent"
  | "duplicate_beta_application"
  | "invalid_phone"
  | "missing_sms_consent"
  | "missing_subscriber"
  | "subscriber_suppressed";

type WelcomeSmsDueReason = "send_due" | "welcome_retry_due";

type WelcomeSmsDecision =
  | {
      reason: WelcomeSmsSkipReason;
      shouldSend: false;
    }
  | {
      reason: WelcomeSmsDueReason;
      shouldSend: true;
    };

export type WelcomeSmsSendResult =
  | {
      ok: true;
      status: "disabled";
      reason: "welcome_sms_disabled";
    }
  | {
      ok: true;
      status: "skipped";
      reason: WelcomeSmsSkipReason;
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

function priorWelcomeFailed(subscriber: SmsSubscriber) {
  const lastProviderStatus = (
    subscriber.sms_provider_status ||
    subscriber.last_sms_status ||
    ""
  ).toLowerCase();

  return (
    subscriber.status === "failed" ||
    lastProviderStatus === "failed" ||
    lastProviderStatus === "undelivered"
  );
}

export function decideWelcomeSmsSend(input: {
  formSubmittedWithSmsConsent: boolean;
  subscriber: SmsSubscriber | null | undefined;
}): WelcomeSmsDecision {
  if (!input.formSubmittedWithSmsConsent) {
    return {
      reason: "duplicate_beta_application",
      shouldSend: false,
    };
  }

  if (!input.subscriber) {
    return {
      reason: "missing_subscriber",
      shouldSend: false,
    };
  }

  const consentCategory = getSmsConsentCategory({
    informational: input.subscriber.sms_informational_consent,
    marketing: input.subscriber.sms_marketing_consent,
  });

  if (!consentCategory) {
    return {
      reason: "missing_sms_consent",
      shouldSend: false,
    };
  }

  if (!isValidE164(input.subscriber.phone_number_e164)) {
    return {
      reason: "invalid_phone",
      shouldSend: false,
    };
  }

  if (!canSendSmsToSubscriber(input.subscriber, consentCategory)) {
    return {
      reason: "subscriber_suppressed",
      shouldSend: false,
    };
  }

  if (input.subscriber.welcome_sms_message_sid) {
    return priorWelcomeFailed(input.subscriber)
      ? {
          reason: "welcome_retry_due",
          shouldSend: true,
        }
      : {
          reason: "already_sent",
          shouldSend: false,
        };
  }

  return {
    reason: "send_due",
    shouldSend: true,
  };
}

export async function sendWelcomeSms(input: {
  foundingNumber?: number | null;
  firstName: string;
  shouldSendWelcomeSms: boolean;
  subscriber: SmsSubscriber | null | undefined;
}): Promise<WelcomeSmsSendResult> {
  const decision = decideWelcomeSmsSend({
    formSubmittedWithSmsConsent: input.shouldSendWelcomeSms,
    subscriber: input.subscriber,
  });

  console.info("[sms] welcome send attempt", {
    ...subscriberLogContext(input.subscriber),
    decisionReason: decision.reason,
    enabled: isWelcomeSmsEnabled(),
    shouldSendWelcomeSms: decision.shouldSend,
    subscriberStatus: input.subscriber?.status,
  });

  if (!decision.shouldSend) {
    console.info("[sms] welcome send skipped", {
      ...subscriberLogContext(input.subscriber),
      reason: decision.reason,
    });

    return {
      ok: true,
      status: "skipped",
      reason: decision.reason,
    };
  }

  if (!isWelcomeSmsEnabled()) {
    console.warn("[sms] welcome send disabled", {
      ...subscriberLogContext(input.subscriber),
      reason: "welcome_sms_disabled",
    });

    return {
      ok: true,
      status: "disabled",
      reason: "welcome_sms_disabled",
    };
  }

  const subscriber = input.subscriber;

  if (!subscriber) {
    return {
      ok: true,
      status: "skipped",
      reason: "missing_subscriber",
    };
  }

  const consentCategory = getSmsConsentCategory({
    informational: subscriber.sms_informational_consent,
    marketing: subscriber.sms_marketing_consent,
  });

  if (!consentCategory) {
    return {
      ok: true,
      status: "skipped",
      reason: "missing_sms_consent",
    };
  }

  try {
    const messageType = "sms_informational_confirmation";
    const statusCallbackUrl = buildSmsStatusCallbackUrl({
      messageType,
      subscriberId: subscriber.id,
    });
    const sendResult = await sendTwilioSms({
      body: getSmsConfirmationTemplate(consentCategory, {
        foundingNumber: input.foundingNumber,
        firstName: input.firstName,
      }),
      statusCallbackUrl,
      to: subscriber.phone_number_e164,
    });
    const now = new Date().toISOString();

    await recordSmsSendAccepted({
      id: subscriber.id,
      messageSid: sendResult.messageSid,
      messageType,
      now,
    });

    console.info("[sms] twilio accepted", {
      ...subscriberLogContext(subscriber),
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
      ...subscriberLogContext(subscriber),
      errorCode,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    try {
      await recordSmsSendFailure({
        id: subscriber.id,
        errorCode,
        errorMessageSafe,
        now: new Date().toISOString(),
      });
    } catch (trackingError) {
      console.error("[sms] failure tracking failed", {
        ...subscriberLogContext(subscriber),
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
