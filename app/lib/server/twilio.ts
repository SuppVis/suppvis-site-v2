import { createHmac, timingSafeEqual } from "crypto";

type TwilioParams = Record<string, string>;

export const SMS_STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);

export const SMS_START_KEYWORDS = new Set(["START", "UNSTOP"]);

export function getSmsKeyword(body: string) {
  return body.trim().split(/\s+/)[0]?.toUpperCase() || "";
}

export function isTwilioSignatureRequired() {
  const configuredValue = process.env.TWILIO_WEBHOOK_SIGNATURE_REQUIRED;

  if (configuredValue === undefined) {
    return process.env.NODE_ENV === "production";
  }

  return configuredValue === "true";
}

export function validateTwilioSignature({
  url,
  params,
  signature,
  authToken,
}: {
  url: string;
  params: TwilioParams;
  signature: string | null;
  authToken: string;
}) {
  if (!signature) {
    return false;
  }

  const signedPayload = Object.keys(params)
    .sort()
    .reduce((payload, key) => `${payload}${key}${params[key]}`, url);
  const expectedSignature = createHmac("sha1", authToken)
    .update(signedPayload)
    .digest("base64");
  const expectedBytes = Buffer.from(expectedSignature);
  const receivedBytes = Buffer.from(signature);

  if (expectedBytes.length !== receivedBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, receivedBytes);
}
