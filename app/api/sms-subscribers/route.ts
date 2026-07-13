import { NextResponse, type NextRequest } from "next/server";
import { SMS_CONSENT_VERSION } from "@/app/lib/smsConsent";
import { stableId } from "@/app/lib/server/crypto";
import { handleApiError } from "@/app/lib/server/errors";
import {
  markSmsResubscribeIfUnsubscribed,
  saveSmsSubscriber,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  isHoneypotFilled,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  normalizePhoneToE164,
  smsSubscriberSchema,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "sms-subscriber",
      limit: 5,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const body = await readJsonBody(request);
    const submission = smsSubscriberSchema.parse(body);

    if (isHoneypotFilled(submission.botField)) {
      return NextResponse.json({ ok: true });
    }

    const phoneE164 = normalizePhoneToE164(submission.phone);

    if (!phoneE164) {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_submission",
          message: "Enter a valid phone number.",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const subscriberId = stableId("sms", phoneE164);

    await markSmsResubscribeIfUnsubscribed({
      id: subscriberId,
      now,
    });

    await saveSmsSubscriber({
      id: subscriberId,
      phone_number_raw: submission.phone.trim(),
      phone_number_e164: phoneE164,
      status: "pending_verification",
      sms_informational_consent: submission.smsInformationalConsent,
      sms_informational_consent_at: submission.smsInformationalConsent
        ? now
        : null,
      sms_marketing_consent: submission.smsMarketingConsent,
      sms_marketing_consent_at: submission.smsMarketingConsent ? now : null,
      sms_consent_timestamp: now,
      sms_consent_source: submission.consentSource,
      sms_consent_version: SMS_CONSENT_VERSION,
      sms_global_opt_out: false,
      sms_global_opt_out_at: null,
      opt_out_timestamp: null,
      opt_out_source: null,
      last_opt_out_keyword: null,
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
