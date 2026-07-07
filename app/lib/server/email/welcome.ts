import {
  SendEmailCommand,
  SESv2Client,
  type SendEmailCommandOutput,
} from "@aws-sdk/client-sesv2";
import { ServerConfigError } from "../errors";
import {
  buildEmailUnsubscribeUrl,
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  isWelcomeEmailEnabled,
  WELCOME_EMAIL_SUBJECT,
} from "../messages/welcome";
import { canSendEmailToSubscriber } from "../persistence";

const EMAIL_MAX_LENGTH = 254;

let sesClient: SESv2Client | null = null;
let sesClientRegion: string | null = null;

type WelcomeEmailSubscriber = {
  id: string;
  email: string;
  normalized_email: string;
  status?: string;
  unsubscribe_token?: string;
};

type WelcomeEmailInput = {
  subscriber: WelcomeEmailSubscriber | null | undefined;
  firstName?: string;
};

export type WelcomeEmailSendResult =
  | {
      ok: true;
      status: "disabled";
      reason: "welcome_email_disabled";
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

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ServerConfigError(`Missing required environment variable: ${name}`);
  }

  return value;
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

function normalizeEmailForSend(subscriber: WelcomeEmailSubscriber) {
  return subscriber.normalized_email.trim().toLowerCase();
}

function hasRequiredUnsubscribeToken(subscriber: WelcomeEmailSubscriber) {
  return Boolean(subscriber.unsubscribe_token?.trim());
}

function buildWelcomeEmailCommand(input: {
  fromEmail: string;
  configurationSetName: string;
  appBaseUrl: string;
  subscriber: WelcomeEmailSubscriber;
  firstName?: string;
}) {
  const recipientEmail = normalizeEmailForSend(input.subscriber);
  const unsubscribeUrl = buildEmailUnsubscribeUrl({
    appBaseUrl: input.appBaseUrl,
    subscriberId: input.subscriber.id,
    token: input.subscriber.unsubscribe_token || "",
  });
  const firstName = input.firstName?.trim() || "there";

  return new SendEmailCommand({
    FromEmailAddress: input.fromEmail,
    ReplyToAddresses: [input.fromEmail],
    Destination: {
      ToAddresses: [recipientEmail],
    },
    ConfigurationSetName: input.configurationSetName,
    EmailTags: [
      {
        Name: "subscriber_id",
        Value: input.subscriber.id,
      },
      {
        Name: "normalized_email",
        Value: recipientEmail,
      },
      {
        Name: "message_type",
        Value: "welcome_beta",
      },
    ],
    Content: {
      Simple: {
        Subject: {
          Charset: "UTF-8",
          Data: WELCOME_EMAIL_SUBJECT,
        },
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: buildWelcomeEmailHtml({
              firstName,
              unsubscribeUrl,
            }),
          },
          Text: {
            Charset: "UTF-8",
            Data: buildWelcomeEmailText({
              firstName,
              unsubscribeUrl,
            }),
          },
        },
      },
    },
  });
}

function sentResult(output: SendEmailCommandOutput): WelcomeEmailSendResult {
  return {
    ok: true,
    status: "sent",
    messageId: output.MessageId,
  };
}

export async function sendWelcomeEmail(
  input: WelcomeEmailInput,
): Promise<WelcomeEmailSendResult> {
  if (!isWelcomeEmailEnabled()) {
    return {
      ok: true,
      status: "disabled",
      reason: "welcome_email_disabled",
    };
  }

  if (!input.subscriber) {
    return {
      ok: true,
      status: "skipped",
      reason: "missing_subscriber",
    };
  }

  const normalizedEmail = normalizeEmailForSend(input.subscriber);

  if (!isValidEmailAddress(normalizedEmail)) {
    return {
      ok: true,
      status: "skipped",
      reason: "invalid_email",
    };
  }

  if (!hasRequiredUnsubscribeToken(input.subscriber)) {
    return {
      ok: true,
      status: "skipped",
      reason: "missing_unsubscribe_token",
    };
  }

  if (!canSendEmailToSubscriber(input.subscriber)) {
    return {
      ok: true,
      status: "skipped",
      reason: "subscriber_suppressed",
    };
  }

  const sesRegion = getRequiredEnv("SES_REGION");
  const fromEmail = getRequiredEnv("SES_FROM_EMAIL");
  const configurationSetName = getRequiredEnv("SES_CONFIGURATION_SET");
  const appBaseUrl = getRequiredEnv("APP_BASE_URL");
  const command = buildWelcomeEmailCommand({
    appBaseUrl,
    configurationSetName,
    firstName: input.firstName,
    fromEmail,
    subscriber: input.subscriber,
  });

  const output = await getSesClient(sesRegion).send(command);

  return sentResult(output);
}
