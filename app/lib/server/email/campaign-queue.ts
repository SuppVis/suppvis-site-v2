import {
  SendMessageCommand,
  SQSClient,
  type SendMessageCommandOutput,
} from "@aws-sdk/client-sqs";
import { ServerConfigError } from "../errors";

let sqsClient: SQSClient | null = null;
let sqsClientRegion: string | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ServerConfigError(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAwsRegion() {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
}

function getSqsClient(region: string) {
  if (!sqsClient || sqsClientRegion !== region) {
    sqsClient = new SQSClient({ region });
    sqsClientRegion = region;
  }

  return sqsClient;
}

export function isAdminEmailBulkInfraReady() {
  return process.env.ADMIN_EMAIL_BULK_SEND_INFRA_READY === "true";
}

export async function enqueueEmailCampaignRecipient(input: {
  campaignId: string;
  subscriberId: string;
}): Promise<SendMessageCommandOutput> {
  const queueUrl = getRequiredEnv("ADMIN_EMAIL_CAMPAIGN_QUEUE_URL");
  const region = getAwsRegion();

  return getSqsClient(region).send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        campaignId: input.campaignId,
        subscriberId: input.subscriberId,
      }),
      MessageAttributes: {
        campaign_id: {
          DataType: "String",
          StringValue: input.campaignId,
        },
        subscriber_id: {
          DataType: "String",
          StringValue: input.subscriberId,
        },
      },
    }),
  );
}
