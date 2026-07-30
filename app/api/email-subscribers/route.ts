import { NextResponse, type NextRequest } from "next/server";
import {
  createUrlSafeToken,
  stableId,
} from "@/app/lib/server/crypto";
import { maybeRestoreBetaSubscriberPriorityByEmail } from "@/app/lib/server/beta-subscribers";
import { handleApiError } from "@/app/lib/server/errors";
import {
  markEmailResubscribeIfUnsubscribed,
  saveEmailSubscriber,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  isHoneypotFilled,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  emailSubscriberSchema,
  normalizeEmail,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "email-subscriber",
      limit: 8,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const body = await readJsonBody(request);
    const submission = emailSubscriberSchema.parse(body);

    if (isHoneypotFilled(submission.botField)) {
      return NextResponse.json({ ok: true });
    }

    const now = new Date().toISOString();
    const normalizedEmail = normalizeEmail(submission.email);
    const subscriberId = stableId("email", normalizedEmail);

    const resubscribeResult = await markEmailResubscribeIfUnsubscribed({
      id: subscriberId,
      now,
    });

    if (resubscribeResult.wrote) {
      await maybeRestoreBetaSubscriberPriorityByEmail({
        normalizedEmail,
        now,
      }).catch((error) => {
        console.error("[beta-priority] email resubscribe restore failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      });
    }

    await saveEmailSubscriber({
      id: subscriberId,
      email: submission.email.trim(),
      normalized_email: normalizedEmail,
      status: "subscribed",
      consent_timestamp: now,
      consent_source: submission.consentSource,
      created_at: now,
      updated_at: now,
      unsubscribe_token: createUrlSafeToken(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
