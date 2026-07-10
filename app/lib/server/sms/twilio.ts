import twilio from "twilio";
import { ServerConfigError } from "../errors";

let twilioClient: ReturnType<typeof twilio> | null = null;
let twilioClientKey: string | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ServerConfigError(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getTwilioClient() {
  const accountSid = getRequiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = getRequiredEnv("TWILIO_AUTH_TOKEN");
  const clientKey = accountSid;

  if (!twilioClient || twilioClientKey !== clientKey) {
    twilioClient = twilio(accountSid, authToken);
    twilioClientKey = clientKey;
  }

  return twilioClient;
}

export function buildSmsStatusCallbackUrl(input: {
  messageType: string;
  subscriberId: string;
}) {
  const callbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL?.trim();

  if (!callbackUrl) {
    throw new ServerConfigError(
      "Missing required environment variable: TWILIO_STATUS_CALLBACK_URL",
    );
  }

  const url = new URL(callbackUrl);
  url.searchParams.set("subscriber", input.subscriberId);
  url.searchParams.set("message_type", input.messageType);

  return url.toString();
}

export async function sendTwilioSms(input: {
  body: string;
  statusCallbackUrl: string;
  to: string;
}) {
  const messagingServiceSid = getRequiredEnv("TWILIO_MESSAGING_SERVICE_SID");
  const message = await getTwilioClient().messages.create({
    body: input.body,
    messagingServiceSid,
    statusCallback: input.statusCallbackUrl,
    to: input.to,
  });

  return {
    messageSid: message.sid,
    status: message.status,
  };
}
