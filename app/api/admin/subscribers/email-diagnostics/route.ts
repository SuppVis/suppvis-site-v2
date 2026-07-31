import {
  GetAccountCommand,
  GetConfigurationSetCommand,
  GetEmailIdentityCommand,
  GetSuppressedDestinationCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import { NextResponse, type NextRequest } from "next/server";
import { stableId } from "@/app/lib/server/crypto";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { getPriorityBetaLimit } from "@/app/lib/server/beta-priority";
import { getBetaApplicationById } from "@/app/lib/server/beta-subscribers";
import { handleApiError, PublicApiError } from "@/app/lib/server/errors";
import {
  buildEmailUnsubscribeUrl,
  buildResubscribeEmailHtml,
  buildResubscribeEmailText,
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  envFlagState,
  FOUNDING_MEMBER_COPY_LIMIT,
  getResubscribeEmailSubject,
  getWelcomeEmailSubject,
  UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED_ENV,
  WELCOME_EMAIL_ENABLED_ENV,
  WELCOME_SMS_ENABLED_ENV,
} from "@/app/lib/server/messages/welcome";
import {
  canSendEmailToSubscriber,
  getEmailSubscriberById,
  getSmsSubscriberById,
  type EmailSubscriberRecord,
} from "@/app/lib/server/persistence";
import { enforceRateLimit } from "@/app/lib/server/request";
import { normalizeEmail } from "@/app/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envPresence(name: string, exposeValue = false) {
  const value = process.env[name]?.trim();

  return {
    present: value !== undefined,
    value: exposeValue ? value || null : value ? "present" : "missing",
  };
}

function foundingNumberForSignupOrder(signupOrderNumber?: number) {
  return signupOrderNumber &&
    signupOrderNumber > 0 &&
    signupOrderNumber <= getPriorityBetaLimit() &&
    signupOrderNumber <= FOUNDING_MEMBER_COPY_LIMIT
    ? signupOrderNumber
    : null;
}

function dateIsSet(value?: string) {
  return Number.isFinite(Date.parse(value || ""));
}

function needsResubscribeEmailCatchup(subscriber: EmailSubscriberRecord | null) {
  if (!subscriber) {
    return false;
  }

  const resubscribedAt = Date.parse(subscriber.resubscribed_at || "");

  if (!Number.isFinite(resubscribedAt)) {
    return false;
  }

  const sentAt = Date.parse(subscriber.resubscribe_email_sent_at || "");

  return !Number.isFinite(sentAt) || sentAt < resubscribedAt;
}

function needsWelcomeEmailCatchup(subscriber: EmailSubscriberRecord | null) {
  if (!subscriber || subscriber.status !== "subscribed") {
    return false;
  }

  if (dateIsSet(subscriber.welcome_email_sent_at)) {
    return false;
  }

  return !needsResubscribeEmailCatchup(subscriber);
}

function currentEmailDecision(input: {
  betaFound: boolean;
  emailSubscriber: EmailSubscriberRecord | null;
}) {
  const subscriber = input.emailSubscriber;

  if (!subscriber) {
    return {
      sendDueOnNextSignup: true,
      skipReason: null,
      transitionType: "first_time_signup",
      variant: "welcome_beta",
    };
  }

  if (subscriber.status === "unsubscribed") {
    return {
      sendDueOnNextSignup: true,
      skipReason: null,
      transitionType: "resubscribe",
      variant: "beta_resubscribe",
    };
  }

  if (!canSendEmailToSubscriber(subscriber)) {
    return {
      sendDueOnNextSignup: false,
      skipReason: "subscriber_suppressed",
      transitionType: "suppressed",
      variant: null,
    };
  }

  if (needsResubscribeEmailCatchup(subscriber)) {
    return {
      sendDueOnNextSignup: true,
      skipReason: null,
      transitionType: "resubscribe_catchup",
      variant: "beta_resubscribe",
    };
  }

  if (input.betaFound && needsWelcomeEmailCatchup(subscriber)) {
    return {
      sendDueOnNextSignup: true,
      skipReason: null,
      transitionType: "welcome_catchup",
      variant: "welcome_beta",
    };
  }

  return {
    sendDueOnNextSignup: false,
    skipReason: "already_subscribed_no_email_due",
    transitionType: "already_subscribed",
    variant: null,
  };
}

function renderDiagnostics(input: {
  appBaseUrl: string;
  firstName: string;
  foundingNumber: number | null;
  subscriber: EmailSubscriberRecord | null;
  variant: "welcome_beta" | "beta_resubscribe" | null;
}) {
  if (!input.variant) {
    return null;
  }

  const unsubscribeUrl =
    input.subscriber?.unsubscribe_token && input.appBaseUrl
      ? buildEmailUnsubscribeUrl({
          appBaseUrl: input.appBaseUrl,
          subscriberId: input.subscriber.id,
          token: input.subscriber.unsubscribe_token,
        })
      : "{{unsubscribe_url}}";
  const templateInput = {
    appBaseUrl: input.appBaseUrl,
    firstName: input.firstName || "there",
    foundingNumber: input.foundingNumber,
    unsubscribeUrl,
  };
  const subject =
    input.variant === "beta_resubscribe"
      ? getResubscribeEmailSubject({ foundingNumber: input.foundingNumber })
      : getWelcomeEmailSubject({ foundingNumber: input.foundingNumber });
  const html =
    input.variant === "beta_resubscribe"
      ? buildResubscribeEmailHtml(templateInput)
      : buildWelcomeEmailHtml(templateInput);
  const text =
    input.variant === "beta_resubscribe"
      ? buildResubscribeEmailText(templateInput)
      : buildWelcomeEmailText(templateInput);

  return {
    containsInvalidPlaceholder:
      /undefined|null|NaN|#0/.test(subject) ||
      /undefined|null|NaN|#0/.test(html) ||
      /undefined|null|NaN|#0/.test(text),
    htmlLength: html.length,
    subject,
    textLength: text.length,
    unsubscribeUrlAvailable: unsubscribeUrl !== "{{unsubscribe_url}}",
    unsubscribeUrlAbsolute:
      unsubscribeUrl === "{{unsubscribe_url}}" || unsubscribeUrl.startsWith("http"),
  };
}

async function getSesDiagnostics(email: string) {
  const region = process.env.SES_REGION?.trim();
  const fromEmail = process.env.SES_FROM_EMAIL?.trim();
  const configurationSet = process.env.SES_CONFIGURATION_SET?.trim();

  if (!region) {
    return {
      account: { status: "missing_configuration", field: "SES_REGION" },
      configurationSet: { status: "not_checked" },
      identity: { status: "not_checked" },
      suppression: { status: "not_checked" },
    };
  }

  const client = new SESv2Client({ region });

  async function safeCheck<T>(
    action: () => Promise<T>,
    map: (value: T) => Record<string, unknown>,
  ) {
    try {
      return { status: "ready", ...map(await action()) };
    } catch (error) {
      return {
        errorName: error instanceof Error ? error.name : "UnknownError",
        status:
          error instanceof Error && error.name === "NotFoundException"
            ? "not_found"
            : "query_failed",
      };
    }
  }

  return {
    account: await safeCheck(
      () => client.send(new GetAccountCommand({})),
      (result) => ({
        enforcementStatus: result.EnforcementStatus || null,
        productionAccessEnabled: Boolean(result.ProductionAccessEnabled),
        sendingEnabled: Boolean(result.SendingEnabled),
      }),
    ),
    configurationSet: configurationSet
      ? await safeCheck(
          () =>
            client.send(
              new GetConfigurationSetCommand({
                ConfigurationSetName: configurationSet,
              }),
            ),
          () => ({ name: configurationSet }),
        )
      : { status: "missing_configuration", field: "SES_CONFIGURATION_SET" },
    identity: fromEmail
      ? await safeCheck(
          () =>
            client.send(
              new GetEmailIdentityCommand({
                EmailIdentity: fromEmail,
              }),
            ),
          (result) => ({
            fromEmail,
            identityType: result.IdentityType || null,
            verifiedForSendingStatus: Boolean(result.VerifiedForSendingStatus),
          }),
        )
      : { status: "missing_configuration", field: "SES_FROM_EMAIL" },
    suppression: await safeCheck(
      () =>
        client.send(
          new GetSuppressedDestinationCommand({
            EmailAddress: email,
          }),
        ),
      (result) => ({
        reason: result.SuppressedDestination?.Reason || null,
        suppressedAt:
          result.SuppressedDestination?.LastUpdateTime?.toISOString() || null,
      }),
    ).then((result) =>
      result.status === "not_found"
        ? { status: "not_suppressed" }
        : result,
    ),
  };
}

export async function GET(request: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(request, {
      scope: "admin-email-diagnostics",
      limit: 20,
      windowMs: 60_000,
    });

    if (rateLimited) {
      return rateLimited;
    }

    await requireAdminSession();
    const rawEmail = request.nextUrl.searchParams.get("email");

    if (!rawEmail) {
      throw new PublicApiError(
        400,
        "missing_email",
        "Provide an email address to inspect.",
      );
    }

    const normalizedEmail = normalizeEmail(rawEmail);
    const betaId = stableId("beta", normalizedEmail);
    const emailSubscriberId = stableId("email", normalizedEmail);
    const betaApplication = await getBetaApplicationById(betaId);
    const emailSubscriber = await getEmailSubscriberById(emailSubscriberId);
    const smsSubscriber =
      betaApplication?.phone_e164
        ? await getSmsSubscriberById(stableId("sms", betaApplication.phone_e164))
        : null;
    const foundingNumber = foundingNumberForSignupOrder(
      betaApplication?.signup_order_number,
    );
    const decision = currentEmailDecision({
      betaFound: Boolean(betaApplication),
      emailSubscriber,
    });
    const appBaseUrl = process.env.APP_BASE_URL?.trim() || "https://www.suppvis.health";
    const render = renderDiagnostics({
      appBaseUrl,
      firstName: betaApplication?.first_name || "there",
      foundingNumber,
      subscriber: emailSubscriber,
      variant: decision.variant as "welcome_beta" | "beta_resubscribe" | null,
    });

    return NextResponse.json(
      {
        ok: true,
        betaApplication: {
          createdAt: betaApplication?.created_at || null,
          found: Boolean(betaApplication),
          id: betaId,
          priorityBeta: Boolean(betaApplication?.priority_beta),
          signupOrderNumber: betaApplication?.signup_order_number || null,
          status: betaApplication?.status || null,
          updatedAt: betaApplication?.updated_at || null,
        },
        decision: {
          ...decision,
          foundingEligible: Boolean(foundingNumber),
          foundingNumber,
          welcomeEmailEnabled: envFlagState(WELCOME_EMAIL_ENABLED_ENV),
        },
        emailSubscriber: {
          found: Boolean(emailSubscriber),
          id: emailSubscriberId,
          lastEmailSentAt: emailSubscriber?.last_email_sent_at || null,
          lastEmailType: emailSubscriber?.last_email_type || null,
          resubscribeEmailSentAt:
            emailSubscriber?.resubscribe_email_sent_at || null,
          resubscribedAt: emailSubscriber?.resubscribed_at || null,
          status: emailSubscriber?.status || null,
          unsubscribedAt: emailSubscriber?.unsubscribed_at || null,
          unsubscribeTokenPresent: Boolean(emailSubscriber?.unsubscribe_token),
          welcomeEmailSentAt: emailSubscriber?.welcome_email_sent_at || null,
        },
        environment: {
          appBaseUrl: envPresence("APP_BASE_URL", true),
          awsDefaultRegion: envPresence("AWS_DEFAULT_REGION", true),
          awsRegion: envPresence("AWS_REGION", true),
          dynamoBetaApplicationsTable: envPresence(
            "DYNAMODB_BETA_APPLICATIONS_TABLE",
            true,
          ),
          dynamoEmailSubscribersTable: envPresence(
            "DYNAMODB_EMAIL_SUBSCRIBERS_TABLE",
            true,
          ),
          dynamoSmsSubscribersTable: envPresence(
            "DYNAMODB_SMS_SUBSCRIBERS_TABLE",
            true,
          ),
          sesConfigurationSet: envPresence("SES_CONFIGURATION_SET", true),
          sesFromEmail: envPresence("SES_FROM_EMAIL", true),
          sesRegion: envPresence("SES_REGION", true),
          unsubscribeConfirmationEmail: envFlagState(
            UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED_ENV,
          ),
          welcomeEmail: envFlagState(WELCOME_EMAIL_ENABLED_ENV),
          welcomeSms: envFlagState(WELCOME_SMS_ENABLED_ENV),
        },
        render,
        ses: await getSesDiagnostics(normalizedEmail),
        smsSubscriber: {
          emailUnsubscribeChangesSmsStatus: false,
          found: Boolean(smsSubscriber),
          status: smsSubscriber?.status || null,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
