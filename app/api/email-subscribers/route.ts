import { NextResponse, type NextRequest } from "next/server";
import {
  createUrlSafeToken,
  stableId,
} from "@/app/lib/server/crypto";
import {
  getBetaApplicationById,
  maybeRestoreBetaSubscriberPriorityByEmail,
} from "@/app/lib/server/beta-subscribers";
import { getPriorityBetaLimit } from "@/app/lib/server/beta-priority";
import { sendResubscribeEmail } from "@/app/lib/server/email/welcome";
import { handleApiError } from "@/app/lib/server/errors";
import { FOUNDING_MEMBER_COPY_LIMIT } from "@/app/lib/server/messages/welcome";
import {
  markEmailResubscribeIfUnsubscribed,
  saveEmailSubscriber,
  type EmailSubscriberRecord,
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

function foundingNumberForSignupOrder(signupOrderNumber?: number) {
  return signupOrderNumber &&
    signupOrderNumber > 0 &&
    signupOrderNumber <= getPriorityBetaLimit() &&
    signupOrderNumber <= FOUNDING_MEMBER_COPY_LIMIT
    ? signupOrderNumber
    : null;
}

function needsResubscribeEmailCatchup(subscriber: EmailSubscriberRecord) {
  const resubscribedAt = Date.parse(subscriber.resubscribed_at || "");

  if (!Number.isFinite(resubscribedAt)) {
    return false;
  }

  const sentAt = Date.parse(subscriber.resubscribe_email_sent_at || "");

  return !Number.isFinite(sentAt) || sentAt < resubscribedAt;
}

async function sendResubscribeEmailIfNeeded(input: {
  foundingNumber?: number | null;
  firstName?: string;
  shouldSend: boolean;
  subscriber: EmailSubscriberRecord;
}) {
  if (!input.shouldSend) {
    return;
  }

  try {
    const result = await sendResubscribeEmail({
      subscriber: input.subscriber,
      firstName: input.firstName || "there",
      foundingNumber: input.foundingNumber,
    });
    const reason = "reason" in result ? result.reason : "email_resubscribed";

    console.info("[welcome-email] email subscriber resubscribe result", {
      status: result.status,
      reason,
      messageId: "messageId" in result ? result.messageId : undefined,
    });
  } catch (error) {
    console.error("[welcome-email] email subscriber resubscribe failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

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
    const betaApplication = await getBetaApplicationById(
      stableId("beta", normalizedEmail),
    );
    const foundingNumber = foundingNumberForSignupOrder(
      betaApplication?.signup_order_number,
    );

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

    const subscriber = await saveEmailSubscriber({
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
    const shouldSendResubscribeEmail =
      resubscribeResult.wrote || needsResubscribeEmailCatchup(subscriber);

    await sendResubscribeEmailIfNeeded({
      foundingNumber,
      firstName: betaApplication?.first_name,
      shouldSend: shouldSendResubscribeEmail,
      subscriber,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
