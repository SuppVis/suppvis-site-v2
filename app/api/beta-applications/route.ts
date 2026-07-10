import { NextResponse, type NextRequest } from "next/server";
import {
  createUrlSafeToken,
  stableId,
} from "@/app/lib/server/crypto";
import {
  sendResubscribeEmail,
  sendWelcomeEmail,
} from "@/app/lib/server/email/welcome";
import { sendWelcomeSms } from "@/app/lib/server/sms/welcome";
import {
  assertDynamoTablesConfigured,
  DYNAMO_TABLE_ENVS,
} from "@/app/lib/server/dynamo";
import { handleApiError } from "@/app/lib/server/errors";
import { isWelcomeEmailEnabled } from "@/app/lib/server/messages/welcome";
import {
  markEmailResubscribeIfUnsubscribed,
  markSmsResubscribeIfUnsubscribed,
  saveBetaApplication,
  saveEmailSubscriber,
  saveSmsSubscriber,
} from "@/app/lib/server/persistence";
import {
  enforceRateLimit,
  isHoneypotFilled,
  readJsonBody,
} from "@/app/lib/server/request";
import {
  betaApplicationSchema,
  normalizeDisplayName,
  normalizeEmail,
  normalizePhoneToE164,
} from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logWelcomeEmailResult(input: {
  status: string;
  reason?: string;
  messageId?: string;
}) {
  console.info("[welcome-email] beta signup result", {
    status: input.status,
    reason: input.reason,
    messageId: input.messageId,
  });
}

async function sendBetaWelcomeEmailIfEnabled(input: {
  shouldSendWelcomeEmail: boolean;
  sendReason: "new_beta_application" | "email_resubscribed";
  subscriber: Awaited<ReturnType<typeof saveEmailSubscriber>>;
  firstName: string;
}) {
  if (!input.shouldSendWelcomeEmail) {
    console.info("[welcome-email] beta signup skipped", {
      reason: "duplicate_beta_application",
    });
    return;
  }

  if (!isWelcomeEmailEnabled()) {
    console.info("[welcome-email] beta signup skipped", {
      reason: "welcome_email_disabled",
      trigger: input.sendReason,
    });
    return;
  }

  try {
    const sendEmail =
      input.sendReason === "email_resubscribed"
        ? sendResubscribeEmail
        : sendWelcomeEmail;
    const result = await sendEmail({
      subscriber: input.subscriber,
      firstName: input.firstName,
    });
    const resultReason =
      "reason" in result && result.reason ? result.reason : input.sendReason;

    logWelcomeEmailResult({
      ...result,
      reason: resultReason,
    });
  } catch (error) {
    console.error("[welcome-email] beta signup failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

async function sendBetaWelcomeSmsIfEnabled(input: {
  shouldSendWelcomeSms: boolean;
  subscriber: Awaited<ReturnType<typeof saveSmsSubscriber>> | null;
}) {
  if (!input.subscriber) {
    return;
  }

  try {
    await sendWelcomeSms({
      shouldSendWelcomeSms: input.shouldSendWelcomeSms,
      subscriber: input.subscriber,
    });
  } catch (error) {
    console.error("[sms] beta signup failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "beta-application",
      limit: 5,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    const body = await readJsonBody(request);
    const submission = betaApplicationSchema.parse(body);

    if (isHoneypotFilled(submission.botField)) {
      return NextResponse.json({ ok: true });
    }

    const now = new Date().toISOString();
    const firstName = normalizeDisplayName(submission.firstName);
    const lastName = normalizeDisplayName(submission.lastName);
    const normalizedEmail = normalizeEmail(submission.email);
    const phoneRaw = submission.phone.trim() || undefined;
    const phoneE164 = phoneRaw
      ? normalizePhoneToE164(phoneRaw) || undefined
      : undefined;
    const betaId = stableId("beta", normalizedEmail);
    const emailSubscriberId = stableId("email", normalizedEmail);
    const requiredTables: string[] = [
      DYNAMO_TABLE_ENVS.betaApplications,
      DYNAMO_TABLE_ENVS.emailSubscribers,
    ];

    if (submission.smsOptIn) {
      requiredTables.push(DYNAMO_TABLE_ENVS.smsSubscribers);
    }

    assertDynamoTablesConfigured(...requiredTables);

    const betaCreated = await saveBetaApplication({
      id: betaId,
      first_name: firstName,
      last_name: lastName,
      email: submission.email.trim(),
      normalized_email: normalizedEmail,
      phone_raw: phoneRaw,
      phone_e164: phoneE164,
      sms_opt_in: submission.smsOptIn,
      status: "new",
      source_page: submission.sourcePage,
      created_at: now,
      updated_at: now,
    });

    const emailResubscribeResult = await markEmailResubscribeIfUnsubscribed({
      id: emailSubscriberId,
      now,
    });
    const emailWasResubscribed = emailResubscribeResult.wrote;

    const emailSubscriber = await saveEmailSubscriber({
      id: emailSubscriberId,
      email: submission.email.trim(),
      normalized_email: normalizedEmail,
      status: "subscribed",
      consent_timestamp: now,
      consent_source: `${submission.sourcePage}:beta_application`,
      created_at: now,
      updated_at: now,
      unsubscribe_token: createUrlSafeToken(),
    });

    let smsSubscriber: Awaited<ReturnType<typeof saveSmsSubscriber>> | null =
      null;

    if (submission.smsOptIn && phoneRaw && phoneE164) {
      const smsSubscriberId = stableId("sms", phoneE164);

      await markSmsResubscribeIfUnsubscribed({
        id: smsSubscriberId,
        now,
      });

      smsSubscriber = await saveSmsSubscriber({
        id: smsSubscriberId,
        phone_number_raw: phoneRaw,
        phone_number_e164: phoneE164,
        status: "pending_verification",
        sms_consent_timestamp: now,
        sms_consent_source: `${submission.sourcePage}:beta_application`,
        opt_out_timestamp: null,
        opt_out_source: null,
        last_opt_out_keyword: null,
        created_at: now,
        updated_at: now,
      });
    }

    await sendBetaWelcomeEmailIfEnabled({
      shouldSendWelcomeEmail: betaCreated || emailWasResubscribed,
      sendReason: emailWasResubscribed
        ? "email_resubscribed"
        : "new_beta_application",
      firstName,
      subscriber: emailSubscriber,
    });

    await sendBetaWelcomeSmsIfEnabled({
      shouldSendWelcomeSms: betaCreated,
      subscriber: smsSubscriber,
    });

    if (emailWasResubscribed) {
      return NextResponse.json({
        ok: true,
        resubscribed: true,
        message:
          "You're subscribed again. We'll send SuppVis beta updates to your email.",
      });
    }

    if (!betaCreated) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: "You're already signed up. We'll reach out with beta access details soon.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
