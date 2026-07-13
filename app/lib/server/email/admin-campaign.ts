import {
  SendEmailCommand,
  SESv2Client,
  type SendEmailCommandOutput,
} from "@aws-sdk/client-sesv2";
import { ServerConfigError } from "../errors";
import type { AdminCampaignRenderedEmail } from "../messages/admin-campaign";

let sesClient: SESv2Client | null = null;
let sesClientRegion: string | null = null;

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

function escapeDisplayName(value: string) {
  return value.replace(/["\\\r\n]/g, "").trim();
}

function formatFromEmailAddress(email: string) {
  const displayName = escapeDisplayName(
    getOptionalEnv("SES_FROM_NAME") || "SuppVis Beta Testers",
  );

  return displayName ? `${displayName} <${email}>` : email;
}

function safeSesTagValue(value: string) {
  return value.replace(/[^\w@.+=:/-]/g, "_").slice(0, 256);
}

function sentResult(output: SendEmailCommandOutput) {
  return {
    ok: true as const,
    messageId: output.MessageId,
  };
}

export function areAdminCampaignsEnabled() {
  return process.env.ADMIN_EMAIL_CAMPAIGNS_ENABLED === "true";
}

export function isAdminEmailTestSendEnabled() {
  return process.env.ADMIN_EMAIL_TEST_SEND_ENABLED === "true";
}

export function isAdminEmailBulkSendEnabled() {
  return process.env.ADMIN_EMAIL_BULK_SEND_ENABLED === "true";
}

export async function sendAdminCampaignTestEmail(input: {
  adminIdentifier: string;
  campaignId: string;
  content: AdminCampaignRenderedEmail;
  recipientEmail: string;
}) {
  const sesRegion = getRequiredEnv("SES_REGION");
  const fromEmail = getRequiredEnv("SES_FROM_EMAIL");
  const configurationSetName = getRequiredEnv("SES_CONFIGURATION_SET");
  const fromEmailAddress = formatFromEmailAddress(fromEmail);

  const command = new SendEmailCommand({
    FromEmailAddress: fromEmailAddress,
    ReplyToAddresses: [fromEmail],
    Destination: {
      ToAddresses: [input.recipientEmail],
    },
    ConfigurationSetName: configurationSetName,
    EmailTags: [
      {
        Name: "campaign_id",
        Value: safeSesTagValue(input.campaignId),
      },
      {
        Name: "message_type",
        Value: "admin_campaign_test",
      },
      {
        Name: "admin_identifier",
        Value: safeSesTagValue(input.adminIdentifier),
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

  const output = await getSesClient(sesRegion).send(command);

  console.info("[admin-email] test send accepted", {
    campaignId: input.campaignId,
    messageId: output.MessageId,
  });

  return sentResult(output);
}
