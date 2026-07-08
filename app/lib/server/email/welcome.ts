import {
  SendEmailCommand,
  SESv2Client,
  type SendEmailCommandOutput,
} from "@aws-sdk/client-sesv2";
import { ServerConfigError } from "../errors";
import {
  buildEmailUnsubscribeUrl,
  buildResubscribeEmailHtml,
  buildResubscribeEmailText,
  buildUnsubscribeConfirmationEmailHtml,
  buildUnsubscribeConfirmationEmailText,
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  isUnsubscribeConfirmationEmailEnabled,
  isWelcomeEmailEnabled,
  RESUBSCRIBE_EMAIL_SUBJECT,
  UNSUBSCRIBE_CONFIRMATION_EMAIL_SUBJECT,
  WELCOME_EMAIL_SUBJECT,
} from "../messages/welcome";
import {
  canSendEmailToSubscriber,
  recordEmailSendAccepted,
  type EmailTrackingMessageType,
} from "../persistence";

const EMAIL_MAX_LENGTH = 254;

let sesClient: SESv2Client | null = null;
let sesClientRegion: string | null = null;

type EmailMessageType = EmailTrackingMessageType;

type EmailSubscriber = {
  id: string;
  email: string;
  normalized_email: string;
  status?: string;
  unsubscribe_token?: string;
};

type SubscriberEmailInput = {
  subscriber: EmailSubscriber | null | undefined;
  firstName?: string;
};

type EmailContent = {
  html: string;
  subject: string;
  text: string;
};

type SendSubscriberEmailInput = SubscriberEmailInput & {
  allowUnsubscribed?: boolean;
  buildContent: (input: {
    appBaseUrl: string;
    unsubscribeUrl?: string;
  }) => EmailContent;
  disabledReason:
    | "welcome_email_disabled"
    | "unsubscribe_confirmation_email_disabled";
  enabled: boolean;
  messageType: EmailMessageType;
  requireUnsubscribeToken?: boolean;
};

export type EmailSendResult =
  | {
      ok: true;
      status: "disabled";
      reason:
        | "welcome_email_disabled"
        | "unsubscribe_confirmation_email_disabled";
    }
  | {
      ok: true;
      status: "skipped";
      reason:
        | "missing_subscriber"
        | "invalid_email"
        | "missing_unsubscribe_token"
        | "subscriber_suppressed";
    }
  | {
      ok: true;
      status: "sent";
      messageId?: string;
    };

export type WelcomeEmailSendResult = EmailSendResult;

type SentEmailResult = Extract<EmailSendResult, { status: "sent" }>;
type EmailSkippedReason = Extract<
  EmailSendResult,
  { status: "skipped" }
>["reason"];

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ServerConfigError(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string) {
  return process.env[name]?.trim();
}

function getSesClient(region: string) {
  if (!sesClient || sesClientRegion !== region) {
    sesClient = new SESv2Client({ region });
    sesClientRegion = region;
  }

  return sesClient;
}

function isValidEmailAddress(email: string) {
  return (
    email.length <= EMAIL_MAX_LENGTH &&
    /^[^\s@]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
      email,
    )
  );
}

function normalizeEmailForSend(subscriber: EmailSubscriber) {
  return subscriber.normalized_email.trim().toLowerCase();
}

function escapeDisplayName(value: string) {
  return value.replace(/["\\\r\n]/g, "").trim();
}

function formatFromEmailAddress(email: string) {
  const displayName = escapeDisplayName(
    getOptionalEnv("SES_FROM_NAME") || "SuppVis Beta Testers",
  );

  return displayName ? `${displayName} <${email}>` : email;
}

function hasRequiredUnsubscribeToken(subscriber: EmailSubscriber) {
  return Boolean(subscriber.unsubscribe_token?.trim());
}

function isSuppressedForConfirmation(subscriber: EmailSubscriber) {
  return subscriber.status === "bounced" || subscriber.status === "complained";
}

function buildSubscriberEmailCommand(input: {
  configurationSetName: string;
  content: EmailContent;
  fromEmailAddress: string;
  messageType: EmailMessageType;
  recipientEmail: string;
  replyToEmail: string;
  subscriber: EmailSubscriber;
}) {
  return new SendEmailCommand({
    FromEmailAddress: input.fromEmailAddress,
    ReplyToAddresses: [input.replyToEmail],
    Destination: {
      ToAddresses: [input.recipientEmail],
    },
    ConfigurationSetName: input.configurationSetName,
    EmailTags: [
      {
        Name: "subscriber_id",
        Value: input.subscriber.id,
      },
      {
        Name: "normalized_email",
        Value: input.recipientEmail,
      },
      {
        Name: "message_type",
        Value: input.messageType,
      },
    ],
    Content: {
      Simple: {
        Subject: {
          Charset: "UTF-8",
          Data: input.content.subject,
        },
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: input.content.html,
          },
          Text: {
            Charset: "UTF-8",
            Data: input.content.text,
          },
        },
      },
    },
  });
}

function sentResult(output: SendEmailCommandOutput): SentEmailResult {
  return {
    ok: true,
    status: "sent",
    messageId: output.MessageId,
  };
}

function subscriberLogContext(input: {
  messageType: EmailMessageType;
  subscriber?: EmailSubscriber | null;
}) {
  return {
    messageType: input.messageType,
    subscriberId: input.subscriber?.id,
  };
}

function logEmailSkipped(input: {
  messageType: EmailMessageType;
  reason: EmailSkippedReason;
  subscriber?: EmailSubscriber | null;
}) {
  console.info("[email] send skipped", {
    ...subscriberLogContext(input),
    reason: input.reason,
    subscriberStatus: input.subscriber?.status,
  });
}

async function recordAcceptedSend(input: {
  messageId?: string;
  messageType: EmailMessageType;
  subscriber: EmailSubscriber;
}) {
  if (!input.messageId) {
    console.warn("[email] tracking skipped", {
      ...subscriberLogContext(input),
      reason: "missing_message_id",
    });

    return;
  }

  try {
    const result = await recordEmailSendAccepted({
      id: input.subscriber.id,
      messageId: input.messageId,
      messageType: input.messageType,
      now: new Date().toISOString(),
    });

    console.info("[email] tracking result", {
      ...subscriberLogContext(input),
      messageId: input.messageId,
      status: result.wrote ? "recorded" : "subscriber_missing",
    });
  } catch (error) {
    console.error("[email] tracking failed", {
      ...subscriberLogContext(input),
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

async function sendSubscriberEmail(
  input: SendSubscriberEmailInput,
): Promise<EmailSendResult> {
  console.info("[email] send attempt", {
    ...subscriberLogContext(input),
    enabled: input.enabled,
    subscriberStatus: input.subscriber?.status,
  });

  if (!input.enabled) {
    console.info("[email] send disabled", {
      ...subscriberLogContext(input),
      reason: input.disabledReason,
    });

    return {
      ok: true,
      status: "disabled",
      reason: input.disabledReason,
    };
  }

  if (!input.subscriber) {
    logEmailSkipped({
      messageType: input.messageType,
      reason: "missing_subscriber",
      subscriber: input.subscriber,
    });

    return {
      ok: true,
      status: "skipped",
      reason: "missing_subscriber",
    };
  }

  const normalizedEmail = normalizeEmailForSend(input.subscriber);

  if (!isValidEmailAddress(normalizedEmail)) {
    logEmailSkipped({
      messageType: input.messageType,
      reason: "invalid_email",
      subscriber: input.subscriber,
    });

    return {
      ok: true,
      status: "skipped",
      reason: "invalid_email",
    };
  }

  if (input.requireUnsubscribeToken && !hasRequiredUnsubscribeToken(input.subscriber)) {
    logEmailSkipped({
      messageType: input.messageType,
      reason: "missing_unsubscribe_token",
      subscriber: input.subscriber,
    });

    return {
      ok: true,
      status: "skipped",
      reason: "missing_unsubscribe_token",
    };
  }

  if (
    input.allowUnsubscribed
      ? isSuppressedForConfirmation(input.subscriber)
      : !canSendEmailToSubscriber(input.subscriber)
  ) {
    logEmailSkipped({
      messageType: input.messageType,
      reason: "subscriber_suppressed",
      subscriber: input.subscriber,
    });

    return {
      ok: true,
      status: "skipped",
      reason: "subscriber_suppressed",
    };
  }

  const sesRegion = getRequiredEnv("SES_REGION");
  const fromEmail = getRequiredEnv("SES_FROM_EMAIL");
  const fromEmailAddress = formatFromEmailAddress(fromEmail);
  const configurationSetName = getRequiredEnv("SES_CONFIGURATION_SET");
  const appBaseUrl = getRequiredEnv("APP_BASE_URL");
  const unsubscribeUrl = input.subscriber.unsubscribe_token
    ? buildEmailUnsubscribeUrl({
        appBaseUrl,
        subscriberId: input.subscriber.id,
        token: input.subscriber.unsubscribe_token,
      })
    : undefined;
  const content = input.buildContent({
    appBaseUrl,
    unsubscribeUrl,
  });
  const command = buildSubscriberEmailCommand({
    configurationSetName,
    content,
    fromEmailAddress,
    messageType: input.messageType,
    recipientEmail: normalizedEmail,
    replyToEmail: fromEmail,
    subscriber: input.subscriber,
  });

  const output = await getSesClient(sesRegion).send(command);
  const result = sentResult(output);

  console.info("[email] ses accepted", {
    ...subscriberLogContext(input),
    messageId: result.messageId,
  });

  await recordAcceptedSend({
    messageId: result.messageId,
    messageType: input.messageType,
    subscriber: input.subscriber,
  });

  return result;
}

export async function sendWelcomeEmail(
  input: SubscriberEmailInput,
): Promise<WelcomeEmailSendResult> {
  return sendSubscriberEmail({
    ...input,
    buildContent: ({ appBaseUrl, unsubscribeUrl }) => ({
      html: buildWelcomeEmailHtml({
        appBaseUrl,
        firstName: input.firstName || "there",
        unsubscribeUrl,
      }),
      subject: WELCOME_EMAIL_SUBJECT,
      text: buildWelcomeEmailText({
        firstName: input.firstName || "there",
        unsubscribeUrl,
      }),
    }),
    disabledReason: "welcome_email_disabled",
    enabled: isWelcomeEmailEnabled(),
    messageType: "welcome_beta",
    requireUnsubscribeToken: true,
  });
}

export async function sendResubscribeEmail(
  input: SubscriberEmailInput,
): Promise<WelcomeEmailSendResult> {
  return sendSubscriberEmail({
    ...input,
    buildContent: ({ appBaseUrl, unsubscribeUrl }) => ({
      html: buildResubscribeEmailHtml({
        appBaseUrl,
        firstName: input.firstName || "there",
        unsubscribeUrl,
      }),
      subject: RESUBSCRIBE_EMAIL_SUBJECT,
      text: buildResubscribeEmailText({
        firstName: input.firstName || "there",
        unsubscribeUrl,
      }),
    }),
    disabledReason: "welcome_email_disabled",
    enabled: isWelcomeEmailEnabled(),
    messageType: "beta_resubscribe",
    requireUnsubscribeToken: true,
  });
}

export async function sendUnsubscribeConfirmationEmail(input: {
  subscriber: EmailSubscriber | null | undefined;
}): Promise<EmailSendResult> {
  return sendSubscriberEmail({
    subscriber: input.subscriber,
    allowUnsubscribed: true,
    buildContent: ({ appBaseUrl }) => ({
      html: buildUnsubscribeConfirmationEmailHtml({
        appBaseUrl,
      }),
      subject: UNSUBSCRIBE_CONFIRMATION_EMAIL_SUBJECT,
      text: buildUnsubscribeConfirmationEmailText({
        appBaseUrl,
      }),
    }),
    disabledReason: "unsubscribe_confirmation_email_disabled",
    enabled: isUnsubscribeConfirmationEmailEnabled(),
    messageType: "beta_unsubscribe_confirmation",
    requireUnsubscribeToken: false,
  });
}
