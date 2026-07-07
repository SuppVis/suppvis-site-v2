import { NextResponse, type NextRequest } from "next/server";
import { stableId } from "@/app/lib/server/crypto";
import {
  PersistenceError,
  ServerConfigError,
} from "@/app/lib/server/errors";
import {
  optOutSmsSubscriber,
  resubscribeSmsSubscriberFromKeyword,
} from "@/app/lib/server/persistence";
import {
  getSmsKeyword,
  isTwilioSignatureRequired,
  SMS_START_KEYWORDS,
  SMS_STOP_KEYWORDS,
  validateTwilioSignature,
} from "@/app/lib/server/twilio";
import {
  normalizePhoneToE164,
  twilioInboundSmsSchema,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function twimlResponse(status = 200) {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params = formDataToParams(formData);
    const signatureRequired = isTwilioSignatureRequired();

    if (signatureRequired) {
      const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

      if (!authToken) {
        return twimlResponse(503);
      }

      const isValidSignature = validateTwilioSignature({
        url: request.url,
        params,
        signature: request.headers.get("x-twilio-signature"),
        authToken,
      });

      if (!isValidSignature) {
        return twimlResponse(401);
      }
    }

    const parsed = twilioInboundSmsSchema.safeParse(params);

    if (!parsed.success) {
      return twimlResponse(400);
    }

    const phoneE164 = normalizePhoneToE164(parsed.data.From);

    if (!phoneE164) {
      return twimlResponse();
    }

    const keyword = getSmsKeyword(parsed.data.Body);
    const now = new Date().toISOString();
    const subscriberId = stableId("sms", phoneE164);

    if (SMS_STOP_KEYWORDS.has(keyword)) {
      await optOutSmsSubscriber({
        id: subscriberId,
        phone_number_e164: phoneE164,
        keyword,
        now,
      });

      return twimlResponse();
    }

    if (SMS_START_KEYWORDS.has(keyword)) {
      await resubscribeSmsSubscriberFromKeyword({
        id: subscriberId,
        phone_number_e164: phoneE164,
        keyword,
        now,
      });

      return twimlResponse();
    }

    return twimlResponse();
  } catch (error) {
    if (
      error instanceof ServerConfigError ||
      error instanceof PersistenceError
    ) {
      return twimlResponse(503);
    }

    console.error("[twilio] sms webhook failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return twimlResponse(500);
  }
}
