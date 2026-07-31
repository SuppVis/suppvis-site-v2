import { NextResponse, type NextRequest } from "next/server";
import { SMS_CONSENT_VERSION } from "@/app/lib/smsConsent";
import {
  createUrlSafeToken,
  stableId,
} from "@/app/lib/server/crypto";
import {
  sendResubscribeEmail,
  sendWelcomeEmail,
} from "@/app/lib/server/email/welcome";
import {
  sendWelcomeSms,
  type WelcomeSmsSendResult,
} from "@/app/lib/server/sms/welcome";
import {
  assertDynamoTablesConfigured,
  DYNAMO_TABLE_ENVS,
} from "@/app/lib/server/dynamo";
import { handleApiError } from "@/app/lib/server/errors";
import {
  FOUNDING_MEMBER_COPY_LIMIT,
  isWelcomeEmailEnabled,
} from "@/app/lib/server/messages/welcome";
import { getPriorityBetaLimit } from "@/app/lib/server/beta-priority";
import {
  betaSignupPriorityFieldsForOrder,
  getBetaApplicationById,
  maybeRestoreBetaSubscriberPriorityByEmail,
  reserveNextBetaSignupOrder,
} from "@/app/lib/server/beta-subscribers";
import {
  markEmailResubscribeIfUnsubscribed,
  markSmsSubscribedIfLegacyPending,
  markSmsWelcomeRetryIfFailed,
  saveBetaApplication,
  saveEmailSubscriber,
  saveSmsSubscriber,
  type EmailSubscriberRecord,
  updateBetaApplicationSmsContact,
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
  console.warn("[welcome-email] beta signup result", {
    status: input.status,
    reason: input.reason,
    messageId: input.messageId,
  });
}

async function sendBetaWelcomeEmailIfEnabled(input: {
  foundingNumber?: number | null;
  includeSmsOptInPrompt?: boolean;
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

  try {
    const sendEmail =
      input.sendReason === "email_resubscribed"
        ? sendResubscribeEmail
        : sendWelcomeEmail;
    const result = await sendEmail({
      subscriber: input.subscriber,
      firstName: input.firstName,
      foundingNumber: input.foundingNumber,
      includeSmsOptInPrompt: input.includeSmsOptInPrompt,
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

function needsResubscribeEmailCatchup(subscriber: EmailSubscriberRecord) {
  const resubscribedAt = Date.parse(subscriber.resubscribed_at || "");

  if (!Number.isFinite(resubscribedAt)) {
    return false;
  }

  const sentAt = Date.parse(subscriber.resubscribe_email_sent_at || "");

  return !Number.isFinite(sentAt) || sentAt < resubscribedAt;
}

function needsWelcomeEmailCatchup(subscriber: EmailSubscriberRecord) {
  if (subscriber.status !== "subscribed") {
    return false;
  }

  if (Number.isFinite(Date.parse(subscriber.welcome_email_sent_at || ""))) {
    return false;
  }

  return !needsResubscribeEmailCatchup(subscriber);
}

async function sendBetaWelcomeSmsIfEnabled(input: {
  foundingNumber?: number | null;
  firstName: string;
  shouldSendWelcomeSms: boolean;
  subscriber: Awaited<ReturnType<typeof saveSmsSubscriber>> | null;
}): Promise<WelcomeSmsSendResult | null> {
  if (!input.subscriber) {
    return null;
  }

  try {
    const result = await sendWelcomeSms({
      firstName: input.firstName,
      foundingNumber: input.foundingNumber,
      shouldSendWelcomeSms: input.shouldSendWelcomeSms,
      subscriber: input.subscriber,
    });

    console.warn("[sms] beta signup result", {
      messageSid: "messageSid" in result ? result.messageSid : undefined,
      reason: "reason" in result ? result.reason : undefined,
      status: result.status,
    });

    return result;
  } catch (error) {
    console.error("[sms] beta signup failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return null;
  }
}

function formatSmsSenderForDisplay() {
  const value = (
    process.env.TWILIO_SMS_FROM_NUMBER?.trim() || "+16507025913"
  ).replace(/[^\d+]/g, "");
  const match = value.match(/^\+1(\d{3})(\d{3})(\d{4})$/);

  return match ? `+1 ${match[1]} ${match[2]} ${match[3]}` : value;
}

function isSmsProviderOptOutResult(
  result: WelcomeSmsSendResult | null,
  subscriber: Awaited<ReturnType<typeof saveSmsSubscriber>> | null,
) {
  return Boolean(
    result &&
      ((result.status === "skipped" &&
        result.reason === "subscriber_suppressed" &&
        (subscriber?.status === "unsubscribed" ||
          subscriber?.status === "opt_out_provider" ||
          subscriber?.sms_global_opt_out)) ||
        (result.status === "failed" && result.errorCode === "21610")),
  );
}

function smsStartRequiredMessage(prefix: "created" | "phone_added") {
  const sender = formatSmsSenderForDisplay();

  if (prefix === "phone_added") {
    return `Your phone number was added, but this number previously opted out of SuppVis texts. Text START to ${sender}, then submit the form again to receive your welcome text.`;
  }

  return `You're in. Your email signup is confirmed, but this phone number previously opted out of SuppVis texts. Text START to ${sender}, then submit the form again to receive your welcome text.`;
}

function smsActivatedMessage() {
  return "You're now signed up for SuppVis texts too. Check your messages for your welcome text.";
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
      console.warn("[beta-application] honeypot rejected", {
        route: "/api/beta-applications",
      });

      return NextResponse.json(
        {
          ok: false,
          code: "invalid_submission",
          message: "Please submit the form again.",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const requestId =
      request.headers.get("x-vercel-id") || createUrlSafeToken().slice(0, 16);
    const firstName = normalizeDisplayName(submission.firstName);
    const lastName = normalizeDisplayName(submission.lastName);
    const normalizedEmail = normalizeEmail(submission.email);
    const phoneRaw = submission.phone.trim() || undefined;
    const phoneE164 = phoneRaw
      ? normalizePhoneToE164(phoneRaw) || undefined
      : undefined;
    const smsInformationalConsent = submission.smsInformationalConsent;
    const smsMarketingConsent = false;
    const hasSmsConsent = smsInformationalConsent || smsMarketingConsent;
    const betaId = stableId("beta", normalizedEmail);
    const emailSubscriberId = stableId("email", normalizedEmail);
    const requiredTables: string[] = [
      DYNAMO_TABLE_ENVS.betaApplications,
      DYNAMO_TABLE_ENVS.emailSubscribers,
    ];

    if (hasSmsConsent) {
      requiredTables.push(DYNAMO_TABLE_ENVS.smsSubscribers);
    }

    assertDynamoTablesConfigured(...requiredTables);

    const existingBetaApplication = await getBetaApplicationById(betaId);
    const existingBetaPhoneE164 = existingBetaApplication?.phone_e164 || "";
    const submittedSmsPhone = Boolean(hasSmsConsent && phoneRaw && phoneE164);
    const phoneAddedToExistingBeta = Boolean(
      existingBetaApplication &&
        submittedSmsPhone &&
        existingBetaPhoneE164 !== phoneE164,
    );
    const signupOrderNumber =
      existingBetaApplication?.signup_order_number ||
      (await reserveNextBetaSignupOrder({ now }));
    const foundingNumber =
      signupOrderNumber > 0 &&
      signupOrderNumber <= getPriorityBetaLimit() &&
      signupOrderNumber <= FOUNDING_MEMBER_COPY_LIMIT
        ? signupOrderNumber
        : null;
    const prioritySignupFields = existingBetaApplication
      ? {}
      : betaSignupPriorityFieldsForOrder({ now, signupOrderNumber });

    const betaCreated = await saveBetaApplication({
      id: betaId,
      record_type: "beta_application",
      first_name: firstName,
      last_name: lastName,
      email: submission.email.trim(),
      normalized_email: normalizedEmail,
      phone_raw: phoneRaw,
      phone_e164: phoneE164,
      sms_opt_in: hasSmsConsent,
      legacy_sms_consent: submission.smsOptIn,
      sms_informational_consent: smsInformationalConsent,
      sms_marketing_consent: smsMarketingConsent,
      sms_consent_version: SMS_CONSENT_VERSION,
      status: "new",
      source_page: submission.sourcePage,
      signup_order_assigned_at: now,
      subscriber_admin_version: 1,
      ...prioritySignupFields,
      created_at: now,
      updated_at: now,
    });
    let betaSmsContactUpdated = false;

    if (!betaCreated && phoneRaw && phoneE164) {
      const betaSmsContactResult = await updateBetaApplicationSmsContact({
        id: betaId,
        phone_raw: phoneRaw,
        phone_e164: phoneE164,
        sms_opt_in: hasSmsConsent,
        legacy_sms_consent: submission.smsOptIn,
        sms_informational_consent: smsInformationalConsent,
        sms_marketing_consent: smsMarketingConsent,
        sms_consent_version: SMS_CONSENT_VERSION,
        source_page: submission.sourcePage,
        updated_at: now,
      });

      betaSmsContactUpdated = betaSmsContactResult.wrote;
    }

    const emailResubscribeResult = await markEmailResubscribeIfUnsubscribed({
      id: emailSubscriberId,
      now,
    });
    const emailWasResubscribed = emailResubscribeResult.wrote;

    if (emailWasResubscribed) {
      await maybeRestoreBetaSubscriberPriorityByEmail({
        normalizedEmail,
        now,
      }).catch((error) => {
        console.error("[beta-priority] beta email resubscribe restore failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      });
    }

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
    const shouldCatchUpResubscribeEmail =
      !betaCreated &&
      !emailWasResubscribed &&
      emailSubscriber.status === "subscribed" &&
      needsResubscribeEmailCatchup(emailSubscriber);
    const shouldCatchUpWelcomeEmail =
      !betaCreated &&
      !emailWasResubscribed &&
      emailSubscriber.status === "subscribed" &&
      needsWelcomeEmailCatchup(emailSubscriber);
    const emailSendReason =
      emailWasResubscribed || shouldCatchUpResubscribeEmail
        ? "email_resubscribed"
        : "new_beta_application";
    const shouldSendWelcomeEmail =
      betaCreated ||
      emailWasResubscribed ||
      shouldCatchUpResubscribeEmail ||
      shouldCatchUpWelcomeEmail;

    console.warn("[welcome-email] beta application decision", {
      requestId,
      route: "/api/beta-applications",
      betaCreated,
      emailSubscriberId,
      emailSubscriberStatus: emailSubscriber.status,
      emailWasResubscribed,
      foundingEligible: Boolean(foundingNumber),
      sendAttemptPlanned: shouldSendWelcomeEmail,
      sendReason: emailSendReason,
      shouldCatchUpResubscribeEmail,
      shouldCatchUpWelcomeEmail,
      signupOrderPresent: signupOrderNumber > 0,
      welcomeEmailEnabled: isWelcomeEmailEnabled(),
    });

    let smsSubscriber: Awaited<ReturnType<typeof saveSmsSubscriber>> | null =
      null;

    if (hasSmsConsent && phoneRaw && phoneE164) {
      const smsSubscriberId = stableId("sms", phoneE164);

      smsSubscriber = await saveSmsSubscriber({
        id: smsSubscriberId,
        phone_number_raw: phoneRaw,
        phone_number_e164: phoneE164,
        status: "subscribed",
        sms_informational_consent: smsInformationalConsent,
        sms_informational_consent_at: smsInformationalConsent ? now : null,
        sms_marketing_consent: smsMarketingConsent,
        sms_marketing_consent_at: smsMarketingConsent ? now : null,
        sms_consent_timestamp: now,
        sms_consent_source: `${submission.sourcePage}:beta_application`,
        sms_consent_version: SMS_CONSENT_VERSION,
        sms_global_opt_out: false,
        sms_global_opt_out_at: null,
        opt_out_timestamp: null,
        opt_out_source: null,
        last_opt_out_keyword: null,
        created_at: now,
        updated_at: now,
      });

      if (smsSubscriber.status === "failed") {
        smsSubscriber = await markSmsWelcomeRetryIfFailed({
          now,
          subscriber: smsSubscriber,
        });
      }

      if (smsSubscriber.status === "pending_verification") {
        smsSubscriber = await markSmsSubscribedIfLegacyPending({
          now,
          subscriber: smsSubscriber,
        });
      }
    }

    await sendBetaWelcomeEmailIfEnabled({
      includeSmsOptInPrompt:
        (betaCreated || shouldCatchUpWelcomeEmail) && !phoneE164,
      shouldSendWelcomeEmail,
      sendReason: emailSendReason,
      firstName,
      foundingNumber,
      subscriber: emailSubscriber,
    });

    const smsWelcomeResult = await sendBetaWelcomeSmsIfEnabled({
      firstName,
      foundingNumber,
      shouldSendWelcomeSms: Boolean(hasSmsConsent && phoneRaw && phoneE164),
      subscriber: smsSubscriber,
    });
    const smsStartRequired = isSmsProviderOptOutResult(
      smsWelcomeResult,
      smsSubscriber,
    );
    const smsWelcomeSent = smsWelcomeResult?.status === "sent";

    if (emailWasResubscribed) {
      return NextResponse.json({
        ok: true,
        result: "resubscribed",
        resubscribed: true,
        smsStartRequired,
        message:
          "You're subscribed again. We'll send SuppVis beta updates to your email.",
      });
    }

    if (!betaCreated) {
      if (smsStartRequired) {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          phoneUpdated: betaSmsContactUpdated,
          result: "sms_start_required",
          smsStartRequired: true,
          smsUpdated: false,
          message: smsStartRequiredMessage(
            phoneAddedToExistingBeta ? "phone_added" : "created",
          ),
        });
      }

      if (phoneAddedToExistingBeta) {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          phoneUpdated: true,
          result: "phone_added",
          smsUpdated: hasSmsConsent,
          smsWelcomeSent,
          message:
            "Your phone number has been added. Check your messages for your SuppVis welcome text.",
        });
      }

      if (smsWelcomeSent && submittedSmsPhone) {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          result: "sms_activated",
          smsUpdated: true,
          smsWelcomeSent: true,
          message: "You're already signed up for the SuppVis beta.",
          supportMessage: smsActivatedMessage(),
        });
      }

      return NextResponse.json({
        ok: true,
        duplicate: true,
        result: "already_registered",
        smsWelcomeSent,
        message: "You're already signed up for the SuppVis beta.",
      });
    }

    return NextResponse.json({
      ok: true,
      result: smsStartRequired ? "sms_start_required" : "created",
      smsStartRequired,
      message: smsStartRequired
        ? smsStartRequiredMessage("created")
        : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
