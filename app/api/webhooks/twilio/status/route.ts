import { NextResponse, type NextRequest } from "next/server";
import {
  PersistenceError,
  ServerConfigError,
} from "@/app/lib/server/errors";
import { recordSmsProviderStatus } from "@/app/lib/server/persistence";
import {
  isTwilioSignatureRequired,
  validateTwilioSignature,
} from "@/app/lib/server/twilio";
import { twilioStatusCallbackSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyResponse(status = 204) {
  return new NextResponse(null, {
    status,
  });
}

function formDataToParams(formData: FormData) {
  const params: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }

  return params;
}

function safeErrorMessage(value: string | undefined) {
  return value
    ?.replace(/\+\d{7,15}/g, "[phone]")
    .replace(/\bAC[a-fA-F0-9]{32}\b/g, "[account]")
    .replace(/\bMG[a-fA-F0-9]{32}\b/g, "[messaging_service]")
    .slice(0, 240);
}

function isSmsSubscriberId(value: string | null): value is string {
  return Boolean(value && /^sms_[a-f0-9]{32}$/.test(value));
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params = formDataToParams(formData);

    if (isTwilioSignatureRequired()) {
      const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

      if (!authToken) {
        return emptyResponse(503);
      }

      const isValidSignature = validateTwilioSignature({
        url: request.url,
        params,
        signature: request.headers.get("x-twilio-signature"),
        authToken,
      });

      if (!isValidSignature) {
        return emptyResponse(401);
      }
    }

    const parsed = twilioStatusCallbackSchema.safeParse(params);

    if (!parsed.success) {
      console.info("[twilio] status callback skipped", {
        reason: "invalid_payload",
      });

      return emptyResponse(400);
    }

    const subscriberId = request.nextUrl.searchParams.get("subscriber");

    if (!isSmsSubscriberId(subscriberId)) {
      console.info("[twilio] status callback skipped", {
        messageSid: parsed.data.MessageSid,
        reason: "missing_subscriber_id",
      });

      return emptyResponse();
    }

    const providerStatus = (
      parsed.data.MessageStatus ||
      parsed.data.SmsStatus ||
      "unknown"
    ).toLowerCase();
    const now = new Date().toISOString();
    const result = await recordSmsProviderStatus({
      id: subscriberId,
      messageSid: parsed.data.MessageSid,
      providerStatus,
      errorCode: parsed.data.ErrorCode,
      errorMessageSafe: safeErrorMessage(parsed.data.ErrorMessage),
      now,
    });

    console.info("[twilio] status callback recorded", {
      messageSid: parsed.data.MessageSid,
      providerStatus,
      status: result.wrote ? "recorded" : "subscriber_missing",
      subscriberId,
    });

    return emptyResponse();
  } catch (error) {
    if (
      error instanceof ServerConfigError ||
      error instanceof PersistenceError
    ) {
      return emptyResponse(503);
    }

    console.error("[twilio] status callback failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return emptyResponse(500);
  }
}
