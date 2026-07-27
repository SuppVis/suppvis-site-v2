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

export function hasAdminSmsCampaignQueue() {
  const queueUrl = process.env.ADMIN_SMS_CAMPAIGN_QUEUE_URL?.trim();

  return Boolean(queueUrl && /^https:\/\/sqs\.[a-z0-9-]+\.amazonaws\.com\//.test(queueUrl));
}

export async function enqueueSmsCampaignRecipient(input: {
  campaignId: string;
  subscriberId: string;
}): Promise<SendMessageCommandOutput> {
  const queueUrl = getRequiredEnv("ADMIN_SMS_CAMPAIGN_QUEUE_URL");
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
        channel: {
          DataType: "String",
          StringValue: "sms",
        },
      },
    }),
  );
}
