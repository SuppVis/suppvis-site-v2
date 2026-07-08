import { NextResponse, type NextRequest } from "next/server";
import { sendUnsubscribeConfirmationEmail } from "@/app/lib/server/email/welcome";
import { handleApiError } from "@/app/lib/server/errors";
import {
  unsubscribeEmailSubscriber,
  type EmailSubscriberRecord,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  readJsonBody,
} from "@/app/lib/server/request";
import { emailUnsubscribeSchema } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logUnsubscribeConfirmationResult(input: {
  status: string;
  reason?: string;
  messageId?: string;
}) {
  console.info("[unsubscribe-email] confirmation result", {
    status: input.status,
    reason: input.reason,
    messageId: input.messageId,
  });
}

async function sendUnsubscribeConfirmationIfEnabled(
  subscriber: EmailSubscriberRecord,
) {
  try {
    const result = await sendUnsubscribeConfirmationEmail({
      subscriber,
    });
    const resultReason = "reason" in result ? result.reason : undefined;

    logUnsubscribeConfirmationResult({
      ...result,
      reason: resultReason,
    });
  } catch (error) {
    console.error("[unsubscribe-email] confirmation failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "email-unsubscribe",
      limit: 10,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const body = await readJsonBody(request);
    const submission = emailUnsubscribeSchema.parse(body);
    const unsubscribedSubscriber = await unsubscribeEmailSubscriber({
      id: submission.subscriberId,
      token: submission.token,
      now: new Date().toISOString(),
    });

    if (!unsubscribedSubscriber) {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_unsubscribe_link",
          message: "This unsubscribe link is invalid or expired.",
        },
        { status: 400 },
      );
    }

    await sendUnsubscribeConfirmationIfEnabled(unsubscribedSubscriber);

    return NextResponse.json({
      ok: true,
      message: "You're unsubscribed from SuppVis emails.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
