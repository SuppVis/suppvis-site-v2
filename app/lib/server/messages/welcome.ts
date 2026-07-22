import { normalizeDisplayName } from "../validation";
import type { SmsConsentCategory } from "@/app/lib/smsConsent";

export const TESTFLIGHT_BETA_URL =
  "https://testflight.apple.com/join/nTASgewZ";

export const WELCOME_EMAIL_SUBJECT = "You're in. Welcome to the SuppVis beta.";

export const WELCOME_EMAIL_PREVIEW_TEXT =
  "Install TestFlight, open SuppVis, and set up your beta account.";

export const RESUBSCRIBE_EMAIL_SUBJECT =
  "You're resubscribed to SuppVis beta updates.";

export const RESUBSCRIBE_EMAIL_PREVIEW_TEXT =
  "We'll keep sending beta access updates and product updates.";

export const UNSUBSCRIBE_CONFIRMATION_EMAIL_SUBJECT =
  "You're unsubscribed from SuppVis beta emails.";

export const UNSUBSCRIBE_CONFIRMATION_EMAIL_PREVIEW_TEXT =
  "You will no longer receive SuppVis beta email updates.";

export const FOUNDER_CONTACT_OUTREACH_EMAIL_SUBJECT =
  "You're invited to the SuppVis beta.";

export const FOUNDER_CONTACT_OUTREACH_EMAIL_PREVIEW_TEXT =
  "A private beta invite from Tanner and Connor Haslinger.";

export const WELCOME_EMAIL_UNSUBSCRIBE_PLACEHOLDER =
  "You're receiving this because you joined the SuppVis beta waitlist. You can unsubscribe at any time.";

export const SMS_INFORMATIONAL_CONFIRMATION_TEMPLATE =
  "SuppVis: You're opted in to recurring beta access and account-related texts, including waitlist status, onboarding, service notices, and support updates. Msg frequency varies. Msg & data rates may apply. Reply HELP for help or STOP to opt out.";

export function getSmsConfirmationTemplate(category: SmsConsentCategory) {
  void category;
  return SMS_INFORMATIONAL_CONFIRMATION_TEMPLATE;
}

export const WELCOME_EMAIL_ENABLED_ENV = "WELCOME_EMAIL_ENABLED";
export const UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED_ENV =
  "UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED";
export const WELCOME_SMS_ENABLED_ENV = "WELCOME_SMS_ENABLED";

type WelcomeTemplateInput = {
  firstName: string;
  unsubscribeUrl?: string;
  appBaseUrl?: string;
};

type UnsubscribeConfirmationTemplateInput = {
  appBaseUrl?: string;
};

type ContactOutreachTemplateInput = {
  appBaseUrl?: string;
};

type UnsubscribeUrlInput = {
  appBaseUrl?: string;
  subscriberId: string;
  token: string;
};

type BrandedEmailHtmlInput = {
  appBaseUrl?: string;
  title: string;
  previewText: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  footerHtml?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeFirstName(firstName: string) {
  return firstName.trim() ? normalizeDisplayName(firstName) : "there";
}

function buildPublicAssetUrl(path: string, appBaseUrl?: string) {
  const baseUrl = (
    appBaseUrl ||
    process.env.APP_BASE_URL ||
    "https://www.suppvis.health"
  ).replace(/\/+$/, "");

  return new URL(path, baseUrl).toString();
}

export function isWelcomeEmailEnabled() {
  return process.env[WELCOME_EMAIL_ENABLED_ENV] === "true";
}

export function isUnsubscribeConfirmationEmailEnabled() {
  return process.env[UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED_ENV] === "true";
}

export function isWelcomeSmsEnabled() {
  return process.env[WELCOME_SMS_ENABLED_ENV] === "true";
}

export function buildEmailUnsubscribeUrl({
  appBaseUrl = process.env.APP_BASE_URL || "https://www.suppvis.health",
  subscriberId,
  token,
}: UnsubscribeUrlInput) {
  const url = new URL("/unsubscribe", appBaseUrl.replace(/\/+$/, ""));
  url.searchParams.set("subscriber", subscriberId);
  url.searchParams.set("token", token);

  return url.toString();
}

function buttonHtml(href: string, label: string) {
  return `<p style="margin:0 0 18px 0;text-align:center;">
                  <a href="${escapeHtml(href)}" style="display:inline-block;border-radius:999px;background:#14B8A6;color:#0A0F14;text-decoration:none;font-size:16px;font-weight:800;padding:14px 24px;">${escapeHtml(label)}</a>
                </p>`;
}

function rawLinkHtml(href: string) {
  return `<p style="margin:0 0 22px 0;color:#9BAFBF;font-size:13px;line-height:1.55;word-break:break-all;text-align:center;">${escapeHtml(href)}</p>`;
}

function websiteUrl(appBaseUrl?: string) {
  return buildPublicAssetUrl("/", appBaseUrl);
}

function waitlistUrl(appBaseUrl?: string) {
  return buildPublicAssetUrl("/#waitlist", appBaseUrl);
}

function feedbackEmail() {
  return process.env.SES_FROM_EMAIL || "beta@suppvis.health";
}

function heroImageHtml(input: {
  alt: string;
  appBaseUrl?: string;
  path: string;
}) {
  const imageUrl = escapeHtml(buildPublicAssetUrl(input.path, input.appBaseUrl));

  return `<p style="margin:0 0 22px 0;text-align:center;">
                  <img src="${imageUrl}" width="584" alt="${escapeHtml(input.alt)}" style="display:block;width:100%;max-width:584px;border:0;border-radius:16px;outline:none;text-decoration:none;" />
                </p>`;
}

function paragraphHtml(copy: string, tone: "primary" | "muted" = "muted") {
  const color = tone === "primary" ? "#D9E2EA" : "#9BAFBF";

  return `<p style="margin:0 0 18px 0;color:${color};font-size:16px;line-height:1.65;">${escapeHtml(copy)}</p>`;
}

function buildBrandedEmailHtml({
  appBaseUrl,
  title,
  previewText,
  eyebrow,
  heading,
  bodyHtml,
  footerHtml,
}: BrandedEmailHtmlInput) {
  const brandIconUrl = escapeHtml(buildPublicAssetUrl("/favicon.svg", appBaseUrl));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#0A0F14;color:#F0F4F8;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(previewText)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F14;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 18px 0;text-align:left;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="text-align:left;vertical-align:middle;">
                      <div style="font-size:24px;line-height:1;font-weight:800;letter-spacing:0;color:#F0F4F8;">SuppVis</div>
                      <div style="padding-top:7px;color:#14B8A6;font-size:11px;line-height:1;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">Beta access</div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <div style="display:inline-block;width:42px;height:42px;border:1px solid rgba(20,184,166,0.42);border-radius:14px;background:rgba(20,184,166,0.10);overflow:hidden;">
                        <img src="${brandIconUrl}" width="42" height="42" alt="SuppVis" style="display:block;width:42px;height:42px;border:0;outline:none;text-decoration:none;" />
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#0D1117;border:1px solid rgba(20,184,166,0.22);border-radius:18px;padding:34px 28px;box-shadow:0 18px 50px rgba(0,0,0,0.28);">
                <p style="margin:0 0 14px 0;color:#14B8A6;font-size:12px;line-height:1;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>
                <h1 style="margin:0 0 22px 0;color:#F0F4F8;font-size:28px;line-height:1.15;font-weight:800;">${escapeHtml(heading)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            ${footerHtml || ""}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function unsubscribeFooterHtml(unsubscribeUrl: string) {
  return `<tr>
              <td style="padding:18px 8px 0 8px;text-align:center;color:#5A7089;font-size:12px;line-height:1.6;">
                ${escapeHtml(WELCOME_EMAIL_UNSUBSCRIBE_PLACEHOLDER)}
                <br />
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#14B8A6;text-decoration:underline;">Unsubscribe</a>
              </td>
            </tr>`;
}

export function buildWelcomeEmailText({
  firstName,
  unsubscribeUrl = "{{unsubscribe_url}}",
}: WelcomeTemplateInput) {
  const name = normalizeFirstName(firstName);
  const feedback = feedbackEmail();

  return `Hi ${name},

Welcome to SuppVis, and thank you for being part of our early beta group. You're getting access before the full launch, and your feedback will directly shape what we build next.

SuppVis is currently in beta on iPhone through TestFlight. Here's how to get in:

1. Install the TestFlight app from the App Store. It's free, and it's how Apple runs beta apps.

2. Tap this link to join:
${TESTFLIGHT_BETA_URL}

3. Open SuppVis and set up your account.

Once you're in, add the supplements and any medications you currently take. That's what lets SuppVis show what the research says and flag interactions worth knowing about.

Because this is beta, you may hit a few rough edges. That's expected, and it helps us improve. When something feels off, confusing, or broken, reply to this email or reach us at ${feedback}.

One important note: SuppVis supports informed decisions about supplements. It is not medical advice and does not replace your doctor or pharmacist, especially when medications are involved. Please talk with your provider before making changes.

We're genuinely glad you're here.

Tanner and Connor

SuppVis

${WELCOME_EMAIL_UNSUBSCRIBE_PLACEHOLDER}
Unsubscribe: ${unsubscribeUrl}`;
}

export function buildWelcomeEmailHtml({
  firstName,
  unsubscribeUrl = "{{unsubscribe_url}}",
  appBaseUrl,
}: WelcomeTemplateInput) {
  const name = normalizeFirstName(firstName);
  const unsubscribeHref = unsubscribeUrl;
  const feedback = feedbackEmail();

  const bodyHtml = [
    paragraphHtml(`Hi ${name},`, "primary"),
    paragraphHtml(
      "Welcome to SuppVis, and thank you for being part of our early beta group. You're getting access before the full launch, and your feedback will directly shape what we build next.",
    ),
    paragraphHtml(
      "SuppVis is currently in beta on iPhone through TestFlight. Here's how to get in:",
    ),
    paragraphHtml("1. Install the TestFlight app from the App Store. It's free, and it's how Apple runs beta apps."),
    paragraphHtml("2. Tap this link to join:"),
    buttonHtml(TESTFLIGHT_BETA_URL, "Open TestFlight beta"),
    rawLinkHtml(TESTFLIGHT_BETA_URL),
    paragraphHtml("3. Open SuppVis and set up your account."),
    paragraphHtml(
      "Once you're in, add the supplements and any medications you currently take. That's what lets SuppVis show what the research says and flag interactions worth knowing about.",
    ),
    paragraphHtml(
      `Because this is beta, you may hit a few rough edges. That's expected, and it helps us improve. When something feels off, confusing, or broken, reply to this email or reach us at ${feedback}.`,
    ),
    paragraphHtml(
      "One important note: SuppVis supports informed decisions about supplements. It is not medical advice and does not replace your doctor or pharmacist, especially when medications are involved. Please talk with your provider before making changes.",
    ),
    paragraphHtml("We're genuinely glad you're here."),
    `<p style="margin:0;color:#D9E2EA;font-size:16px;line-height:1.65;">Tanner and Connor<br />SuppVis</p>`,
  ].join("\n                ");

  return buildBrandedEmailHtml({
    appBaseUrl,
    bodyHtml,
    eyebrow: "Beta access",
    footerHtml: unsubscribeFooterHtml(unsubscribeHref),
    heading: "You're in.",
    previewText: WELCOME_EMAIL_PREVIEW_TEXT,
    title: WELCOME_EMAIL_SUBJECT,
  });
}

export function buildResubscribeEmailText({
  firstName,
  unsubscribeUrl = "{{unsubscribe_url}}",
}: WelcomeTemplateInput) {
  const name = normalizeFirstName(firstName);
  const feedback = feedbackEmail();

  return `Hi ${name},

Thanks for resubscribing to SuppVis beta updates.

You're back on the list for beta access updates, product updates, and TestFlight details.

If you still need the beta app, here's how to get in:

1. Install the TestFlight app from the App Store.

2. Tap this link to join:
${TESTFLIGHT_BETA_URL}

3. Open SuppVis and set up your account.

Once you're in, add the supplements and any medications you currently take so SuppVis can show what the research says and flag interactions worth knowing about.

If something feels off, confusing, or broken during beta, reply to this email or reach us at ${feedback}.

One important note: SuppVis supports informed decisions about supplements. It is not medical advice and does not replace your doctor or pharmacist, especially when medications are involved. Please talk with your provider before making changes.

If you ever want to opt out again, use the unsubscribe link below.

Tanner and Connor

SuppVis

${WELCOME_EMAIL_UNSUBSCRIBE_PLACEHOLDER}
Unsubscribe: ${unsubscribeUrl}`;
}

export function buildResubscribeEmailHtml({
  firstName,
  unsubscribeUrl = "{{unsubscribe_url}}",
  appBaseUrl,
}: WelcomeTemplateInput) {
  const name = normalizeFirstName(firstName);
  const unsubscribeHref = unsubscribeUrl;
  const feedback = feedbackEmail();
  const bodyHtml = [
    paragraphHtml(`Hi ${name},`, "primary"),
    paragraphHtml("Thanks for resubscribing to SuppVis beta updates."),
    paragraphHtml(
      "You're back on the list for beta access updates, product updates, and TestFlight details.",
    ),
    paragraphHtml("If you still need the beta app, here's how to get in:"),
    paragraphHtml("1. Install the TestFlight app from the App Store."),
    paragraphHtml("2. Tap this link to join:"),
    buttonHtml(TESTFLIGHT_BETA_URL, "Open TestFlight beta"),
    rawLinkHtml(TESTFLIGHT_BETA_URL),
    paragraphHtml("3. Open SuppVis and set up your account."),
    paragraphHtml(
      "Once you're in, add the supplements and any medications you currently take so SuppVis can show what the research says and flag interactions worth knowing about.",
    ),
    paragraphHtml(
      `If something feels off, confusing, or broken during beta, reply to this email or reach us at ${feedback}.`,
    ),
    paragraphHtml(
      "One important note: SuppVis supports informed decisions about supplements. It is not medical advice and does not replace your doctor or pharmacist, especially when medications are involved. Please talk with your provider before making changes.",
    ),
    paragraphHtml("If you ever want to opt out again, use the unsubscribe link below."),
    `<p style="margin:0;color:#D9E2EA;font-size:16px;line-height:1.65;">Tanner and Connor<br />SuppVis</p>`,
  ].join("\n                ");

  return buildBrandedEmailHtml({
    appBaseUrl,
    bodyHtml,
    eyebrow: "Beta updates",
    footerHtml: unsubscribeFooterHtml(unsubscribeHref),
    heading: "You're resubscribed.",
    previewText: RESUBSCRIBE_EMAIL_PREVIEW_TEXT,
    title: RESUBSCRIBE_EMAIL_SUBJECT,
  });
}

export function buildUnsubscribeConfirmationEmailText({
  appBaseUrl,
}: UnsubscribeConfirmationTemplateInput = {}) {
  const siteUrl = buildPublicAssetUrl("/", appBaseUrl);

  return `You've been unsubscribed from SuppVis beta emails.

Sad to see you go - you'll no longer receive SuppVis beta announcements, beta access updates, or product updates at this email.

If you ever want to receive beta updates again, you can sign up again at ${siteUrl}.

SuppVis`;
}

export function buildUnsubscribeConfirmationEmailHtml({
  appBaseUrl,
}: UnsubscribeConfirmationTemplateInput = {}) {
  const siteUrl = buildPublicAssetUrl("/", appBaseUrl);
  const bodyHtml = [
    paragraphHtml(
      "Sad to see you go - you'll no longer receive SuppVis beta announcements, beta access updates, or product updates at this email.",
    ),
    paragraphHtml(
      "If you ever want to receive beta updates again, you can sign up again at the SuppVis website.",
    ),
    buttonHtml(siteUrl, "Back to SuppVis"),
    rawLinkHtml(siteUrl),
  ].join("\n                ");

  return buildBrandedEmailHtml({
    appBaseUrl,
    bodyHtml,
    eyebrow: "Email preferences",
    heading: "You've been unsubscribed.",
    previewText: UNSUBSCRIBE_CONFIRMATION_EMAIL_PREVIEW_TEXT,
    title: UNSUBSCRIBE_CONFIRMATION_EMAIL_SUBJECT,
  });
}

export function buildFounderContactOutreachEmailText({
  appBaseUrl,
}: ContactOutreachTemplateInput = {}) {
  const signupUrl = waitlistUrl(appBaseUrl);

  return `Hey, it's Tanner and Connor Haslinger.

We've spent the last year building SuppVis, a platform that changes the way people interact with supplements and wellness.

We noticed that so many supplements are bought because of fads, marketing, and empty promises. SuppVis is for people who are tired of guessing. It helps you understand how each supplement may affect your goals, using peer-reviewed research instead of marketing claims.

SuppVis learns from your supplement stack, medications, conditions, and goals to create a more personalized view of what may matter for your body, including possible interactions worth knowing about.

We're opening a private beta and looking for a founding group to try it first.

If you've ever stood in a supplement aisle with no idea what's worth it, come see what we're building and grab your spot on the waitlist:
${signupUrl}

One favor: forward this to anyone you know who cares about their health. The more people we get in early, the better we can make this.

Clarity over complexity. Science over hype.

Thank you so much,

Tanner and Connor`;
}

export function buildFounderContactOutreachEmailHtml({
  appBaseUrl,
}: ContactOutreachTemplateInput = {}) {
  const signupUrl = waitlistUrl(appBaseUrl);
  const bodyHtml = [
    heroImageHtml({
      alt: "Tanner and Connor Haslinger",
      appBaseUrl,
      path: "/homecontan.jpg",
    }),
    paragraphHtml("Hey, it's Tanner and Connor Haslinger.", "primary"),
    paragraphHtml(
      "We've spent the last year building SuppVis, a platform that changes the way people interact with supplements and wellness.",
    ),
    paragraphHtml(
      "We noticed that so many supplements are bought because of fads, marketing, and empty promises. SuppVis is for people who are tired of guessing. It helps you understand how each supplement may affect your goals, using peer-reviewed research instead of marketing claims.",
    ),
    paragraphHtml(
      "SuppVis learns from your supplement stack, medications, conditions, and goals to create a more personalized view of what may matter for your body, including possible interactions worth knowing about.",
    ),
    paragraphHtml("We're opening a private beta and looking for a founding group to try it first."),
    paragraphHtml(
      "If you've ever stood in a supplement aisle with no idea what's worth it, come see what we're building and grab your spot on the waitlist:",
    ),
    buttonHtml(signupUrl, "Join the SuppVis beta"),
    rawLinkHtml(signupUrl),
    paragraphHtml(
      "One favor: forward this to anyone you know who cares about their health. The more people we get in early, the better we can make this.",
    ),
    paragraphHtml("Clarity over complexity. Science over hype.", "primary"),
    `<p style="margin:0;color:#D9E2EA;font-size:16px;line-height:1.65;">Thank you so much,<br />Tanner and Connor</p>`,
  ].join("\n                ");

  return buildBrandedEmailHtml({
    appBaseUrl,
    bodyHtml,
    eyebrow: "Private beta invite",
    heading: "You're invited to the SuppVis beta.",
    previewText: FOUNDER_CONTACT_OUTREACH_EMAIL_PREVIEW_TEXT,
    title: FOUNDER_CONTACT_OUTREACH_EMAIL_SUBJECT,
  });
}
