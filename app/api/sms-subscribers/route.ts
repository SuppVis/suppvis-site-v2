import { NextResponse, type NextRequest } from "next/server";
import { stableId } from "@/app/lib/server/crypto";
import { handleApiError } from "@/app/lib/server/errors";
import { saveSmsSubscriber } from "@/app/lib/server/persistence";
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

    await saveSmsSubscriber({
      id: stableId("sms", phoneE164),
      phone_number_raw: submission.phone.trim(),
      phone_number_e164: phoneE164,
      status: "pending_verification",
      sms_consent_timestamp: now,
      sms_consent_source: submission.consentSource,
      opt_out_timestamp: null,
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
