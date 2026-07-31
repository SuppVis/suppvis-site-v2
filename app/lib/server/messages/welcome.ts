import { normalizeDisplayName } from "../validation";
import type { SmsConsentCategory } from "@/app/lib/smsConsent";

export const TESTFLIGHT_BETA_URL =
  "https://testflight.apple.com/join/nTASgewZ";

export const FOUNDING_MEMBER_COPY_LIMIT = 300;

export const FOUNDING_WELCOME_EMAIL_FALLBACK_SUBJECT =
  "You're one of 300 founding members";

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
  `SuppVis: Welcome to the beta, {{first_name}}! Your account is ready. Open the app to complete onboarding and build your personalized supplement fingerprint: ${TESTFLIGHT_BETA_URL}

Reply HELP for help or STOP to opt out. Msg & data rates may apply.`;

export const FOUNDING_MEMBER_SMS_CONFIRMATION_TEMPLATE =
  "You're in. You've claimed one of 300 founding member spots at SuppVis. Founding members get first access starting Friday, August 7, their first month free, and the chance to lock in the lowest rate we will ever offer, for life. Full details just landed in your email.";

export function getSmsConfirmationTemplate(
  category: SmsConsentCategory,
  input: { firstName?: string; foundingNumber?: number | null } = {},
) {
  void category;
  if (isValidFoundingNumber(input.foundingNumber)) {
    return FOUNDING_MEMBER_SMS_CONFIRMATION_TEMPLATE;
  }

  const firstName = normalizeFirstName(input.firstName || "");

  return SMS_INFORMATIONAL_CONFIRMATION_TEMPLATE.replace(
    "{{first_name}}",
    firstName,
  );
}

export const WELCOME_EMAIL_ENABLED_ENV = "WELCOME_EMAIL_ENABLED";
export const UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED_ENV =
  "UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED";
export const WELCOME_SMS_ENABLED_ENV = "WELCOME_SMS_ENABLED";

type WelcomeTemplateInput = {
  foundingNumber?: number | null;
  firstName: string;
  includeSmsOptInPrompt?: boolean;
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

function isValidFoundingNumber(value: number | null | undefined) {
  return Boolean(
    Number.isInteger(value) &&
      value &&
      value > 0 &&
      value <= FOUNDING_MEMBER_COPY_LIMIT,
  );
}

export function getWelcomeEmailSubject(input?: {
  foundingNumber?: number | null;
}) {
  return isValidFoundingNumber(input?.foundingNumber)
    ? getFoundingWelcomeEmailSubject(input)
    : WELCOME_EMAIL_SUBJECT;
}

export function getFoundingWelcomeEmailSubject(input?: {
  foundingNumber?: number | null;
}) {
  return isValidFoundingNumber(input?.foundingNumber)
    ? `You're founding member #${input?.foundingNumber} of ${FOUNDING_MEMBER_COPY_LIMIT}`
    : FOUNDING_WELCOME_EMAIL_FALLBACK_SUBJECT;
}

export function getResubscribeEmailSubject(input?: {
  foundingNumber?: number | null;
}) {
  return isValidFoundingNumber(input?.foundingNumber)
    ? getWelcomeEmailSubject(input)
    : RESUBSCRIBE_EMAIL_SUBJECT;
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
  const brandIconUrl = escapeHtml(
    buildPublicAssetUrl("/email/suppvis-logo.png", appBaseUrl),
  );

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

function foundingNumberDisplay(foundingNumber: number | null | undefined) {
  return isValidFoundingNumber(foundingNumber)
    ? `#${foundingNumber}`
    : "Founding member";
}

function foundingWelcomeEmailText({
  firstName,
  foundingNumber,
  unsubscribeUrl = "{{unsubscribe_url}}",
}: WelcomeTemplateInput) {
  const name = normalizeFirstName(firstName);
  const credential = isValidFoundingNumber(foundingNumber)
    ? `Founding Member #${foundingNumber} of ${FOUNDING_MEMBER_COPY_LIMIT}`
    : `Founding Member of ${FOUNDING_MEMBER_COPY_LIMIT}`;

  return `${credential}

Welcome to SuppVis, ${name}. You're one of 300 people who get to be here first.

What you get

1. First access starting Friday, August 7, before anyone else.
2. Your first month, completely free. No conditions.
3. The founding member rate: the lowest price SuppVis will ever offer, held for life.

How you lock in the founding rate

The lifetime rate is earned, not automatic. Stay active through your first free month by logging your daily check-in at least 5 days a week, and the founding rate is yours permanently. If life gets in the way and you fall short, you'll still have full access at standard pricing after your free month ends.

We built it this way on purpose. SuppVis only works when you log consistently, and the founding rate belongs to the people who put it to work.

What SuppVis is

Stop guessing whether your stack is working. SuppVis tracks what you take and how you feel, every day. After 14 days of check-ins, it starts showing you what's actually moving the needle for you. Not what a brand claims. Not what an influencer promoted. What your own data shows.

Every insight is grounded in a research base of more than 24,500 peer-reviewed studies, and your stack is screened against more than 2,300 known drug and supplement interactions. Brand-agnostic. Evidence-based. No supplement company funds us or dictates what we recommend.

When you get access

Access begins Friday, August 7. Invites go out in the order you signed up, in small groups over launch weekend, so every founding member gets a smooth start. The full founding cohort will be in by Sunday.

What we ask of you

Log daily, especially your first 14 days. That's when your first personalized insights arrive. And tell us everything: what's confusing, what's broken, what you wish existed. You're not just early. Your feedback shapes what SuppVis becomes.

See how SuppVis works:
https://www.suppvis.health/how-it-works

Clarity over complexity. Science over hype.

Tanner and Connor Haslinger
Co-founders, SuppVis

You're receiving this because you claimed a founding member spot at suppvis.health.
Privacy Policy: https://www.suppvis.health/privacy
Terms of Use: https://www.suppvis.health/terms
Medical Disclaimer: https://www.suppvis.health/medical-disclaimer
Unsubscribe: ${unsubscribeUrl}

2026 SuppVis. Not medical advice. Always consult your healthcare provider.`;
}

function foundingWelcomeEmailHtml({
  appBaseUrl,
  firstName,
  foundingNumber,
  unsubscribeUrl = "{{unsubscribe_url}}",
}: WelcomeTemplateInput) {
  const name = normalizeFirstName(firstName);
  const title = getFoundingWelcomeEmailSubject({ foundingNumber });
  const logoUrl = escapeHtml(
    buildPublicAssetUrl("/email/suppvis-logo.png", appBaseUrl),
  );
  const howItWorksUrl = escapeHtml(
    buildPublicAssetUrl("/how-it-works", appBaseUrl),
  );
  const privacyUrl = escapeHtml(buildPublicAssetUrl("/privacy", appBaseUrl));
  const termsUrl = escapeHtml(buildPublicAssetUrl("/terms", appBaseUrl));
  const disclaimerUrl = escapeHtml(
    buildPublicAssetUrl("/medical-disclaimer", appBaseUrl),
  );
  const numberMarkup = escapeHtml(foundingNumberDisplay(foundingNumber));
  const numberSubtext = isValidFoundingNumber(foundingNumber)
    ? `of ${FOUNDING_MEMBER_COPY_LIMIT}, ever`
    : `one of ${FOUNDING_MEMBER_COPY_LIMIT}, ever`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(title)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,800&display=swap');
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  img { border:0; line-height:100%; }
  a { color:#11AA98; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .px { padding-left:24px !important; padding-right:24px !important; }
    .card-number { font-size:64px !important; }
    .stat-cell { display:block !important; width:100% !important; padding:0 0 16px 0 !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F6F8F8;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
  First access August 7. Your first month free. The lowest rate we will ever offer.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F6F8F8;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px;">
    <tr><td align="center" style="padding:8px 0 24px 0;">
      <a href="https://www.suppvis.health" style="text-decoration:none;">
        <img src="${logoUrl}" width="140" height="140" alt="SuppVis" style="display:block;width:140px;height:140px;border:0;outline:none;text-decoration:none;margin:0 auto 8px auto;" />
        <span style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:22px; font-weight:800; color:#0E2A28; letter-spacing:0;">SuppVis</span>
      </a>
    </td></tr>
    <tr><td style="background-color:#FFFFFF; border-radius:16px; overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:6px; background-color:#11AA98; font-size:0; line-height:0;">&nbsp;</td></tr>
        <tr><td align="center" class="px" style="padding:44px 48px 8px 48px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1.5px solid #D5E9E6; border-radius:12px;">
            <tr><td align="center" style="padding:28px 20px 24px 20px;">
              <div style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:12px; font-weight:700; letter-spacing:3px; color:#11AA98; text-transform:uppercase; padding-bottom:10px;">Founding Member</div>
              <div class="card-number" style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:76px; font-weight:800; line-height:1; color:#0E2A28; letter-spacing:0;">${numberMarkup}</div>
              <div style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:14px; font-weight:500; color:#5C7370; padding-top:10px;">${escapeHtml(numberSubtext)}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td class="px" style="padding:32px 48px 0 48px;">
          <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:16px; line-height:26px; color:#33403E; margin:0;">
            Welcome to SuppVis, ${escapeHtml(name)}. You're one of 300 people who get to be here first.
          </p>
        </td></tr>
        <tr><td class="px" style="padding:36px 48px 0 48px;">
          <h2 style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:13px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#11AA98; margin:0 0 16px 0;">What you get</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="26" valign="top" style="font-family:'DM Sans',Helvetica,Arial,sans-serif; font-size:15px; font-weight:800; color:#0E2A28; padding:0 0 14px 0;">1</td>
              <td style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#33403E; padding:0 0 14px 0;"><strong style="color:#0E2A28;">First access starting Friday, August 7,</strong> before anyone else.</td>
            </tr>
            <tr>
              <td width="26" valign="top" style="font-family:'DM Sans',Helvetica,Arial,sans-serif; font-size:15px; font-weight:800; color:#0E2A28; padding:0 0 14px 0;">2</td>
              <td style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#33403E; padding:0 0 14px 0;"><strong style="color:#0E2A28;">Your first month, completely free.</strong> No conditions.</td>
            </tr>
            <tr>
              <td width="26" valign="top" style="font-family:'DM Sans',Helvetica,Arial,sans-serif; font-size:15px; font-weight:800; color:#0E2A28;">3</td>
              <td style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#33403E;"><strong style="color:#0E2A28;">The founding member rate:</strong> the lowest price SuppVis will ever offer, held for life.</td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="px" style="padding:36px 48px 0 48px;">
          <h2 style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:13px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#11AA98; margin:0 0 12px 0;">How you lock in the founding rate</h2>
          <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#33403E; margin:0 0 12px 0;">
            The lifetime rate is earned, not automatic. Stay active through your first free month by logging your daily check-in at least <strong style="color:#0E2A28;">5 days a week</strong>, and the founding rate is yours permanently. If life gets in the way and you fall short, you'll still have full access at standard pricing after your free month ends.
          </p>
          <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#33403E; margin:0;">
            We built it this way on purpose. SuppVis only works when you log consistently, and the founding rate belongs to the people who put it to work.
          </p>
        </td></tr>
        <tr><td class="px" style="padding:36px 48px 0 48px;">
          <h2 style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:13px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#11AA98; margin:0 0 12px 0;">What SuppVis is</h2>
          <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#33403E; margin:0 0 12px 0;">
            Stop guessing whether your stack is working. SuppVis tracks what you take and how you feel, every day. After 14 days of check-ins, it starts showing you what's actually moving the needle for you. Not what a brand claims. Not what an influencer promoted. What your own data shows.
          </p>
          <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#33403E; margin:0 0 20px 0;">
            Brand-agnostic. Evidence-based. No supplement company funds us or dictates what we recommend.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F9F8; border-radius:12px;">
            <tr>
              <td class="stat-cell" width="50%" align="center" style="padding:20px 12px;">
                <div style="font-family:'DM Sans',Helvetica,Arial,sans-serif; font-size:28px; font-weight:800; color:#0E2A28;">24,500+</div>
                <div style="font-family:'DM Sans',Helvetica,Arial,sans-serif; font-size:12px; font-weight:500; letter-spacing:0.5px; color:#5C7370; padding-top:4px;">peer-reviewed studies behind every insight</div>
              </td>
              <td class="stat-cell" width="50%" align="center" style="padding:20px 12px; border-left:1px solid #DCEBE9;">
                <div style="font-family:'DM Sans',Helvetica,Arial,sans-serif; font-size:28px; font-weight:800; color:#0E2A28;">2,300+</div>
                <div style="font-family:'DM Sans',Helvetica,Arial,sans-serif; font-size:12px; font-weight:500; letter-spacing:0.5px; color:#5C7370; padding-top:4px;">drug and supplement interactions screened</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="px" style="padding:36px 48px 0 48px;">
          <h2 style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:13px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#11AA98; margin:0 0 12px 0;">When you get access</h2>
          <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#33403E; margin:0;">
            Access begins Friday, August 7. Invites go out in the order you signed up, in small groups over launch weekend, so every founding member gets a smooth start. The full founding cohort will be in by Sunday.
          </p>
        </td></tr>
        <tr><td class="px" style="padding:36px 48px 0 48px;">
          <h2 style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:13px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#11AA98; margin:0 0 12px 0;">What we ask of you</h2>
          <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#33403E; margin:0;">
            Log daily, especially your first 14 days. That's when your first personalized insights arrive. And tell us everything: what's confusing, what's broken, what you wish existed. You're not just early. Your feedback shapes what SuppVis becomes.
          </p>
        </td></tr>
        <tr><td align="center" class="px" style="padding:36px 48px 8px 48px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="background-color:#11AA98; border-radius:10px;">
              <a href="${howItWorksUrl}" style="display:inline-block; padding:14px 32px; font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; font-weight:700; color:#FFFFFF; text-decoration:none;">See how SuppVis works</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td class="px" style="padding:36px 48px 44px 48px;">
          <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#33403E; margin:0 0 20px 0;">
            Clarity over complexity. Science over hype.
          </p>
          <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#0E2A28; font-weight:700; margin:0;">
            Tanner and Connor Haslinger
          </p>
          <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; color:#5C7370; margin:2px 0 0 0;">
            Co-founders, SuppVis
          </p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:28px 24px 8px 24px;">
      <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:12px; line-height:19px; color:#8AA09D; margin:0 0 10px 0;">
        You're receiving this because you claimed a founding member spot at suppvis.health.
      </p>
      <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:12px; line-height:19px; color:#8AA09D; margin:0 0 10px 0;">
        <a href="${privacyUrl}" style="color:#8AA09D;">Privacy Policy</a> &nbsp;&middot;&nbsp; <a href="${termsUrl}" style="color:#8AA09D;">Terms of Use</a> &nbsp;&middot;&nbsp; <a href="${disclaimerUrl}" style="color:#8AA09D;">Medical Disclaimer</a> &nbsp;&middot;&nbsp; <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8AA09D;">Unsubscribe</a>
      </p>
      <p style="font-family:'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:12px; line-height:19px; color:#8AA09D; margin:0;">
        &copy; 2026 SuppVis. Not medical advice. Always consult your healthcare provider.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function smsOptInPromptText(appBaseUrl?: string) {
  const signupUrl = waitlistUrl(appBaseUrl);

  return `Want beta text updates too?

You can add your phone number on SuppVis to receive beta access instructions, onboarding updates, and account-related texts. Use the same email address you used for this signup.

Add your phone number:
${signupUrl}`;
}

function smsOptInPromptHtml(appBaseUrl?: string) {
  const signupUrl = waitlistUrl(appBaseUrl);

  return `<div style="margin:26px 0 6px 0;padding:22px;border:1px solid rgba(20,184,166,0.28);border-radius:16px;background:rgba(20,184,166,0.08);">
                  <p style="margin:0 0 8px 0;color:#14B8A6;font-size:12px;line-height:1;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">Optional beta texts</p>
                  <p style="margin:0 0 14px 0;color:#D9E2EA;font-size:16px;line-height:1.55;font-weight:700;">Want beta text updates too?</p>
                  <p style="margin:0 0 18px 0;color:#9BAFBF;font-size:15px;line-height:1.6;">Add your phone number to receive SuppVis beta access instructions, onboarding updates, and account-related texts. Use the same email address you used for this signup.</p>
                  ${buttonHtml(signupUrl, "Add phone number")}
                </div>`;
}

export function buildWelcomeEmailText({
  appBaseUrl,
  foundingNumber,
  firstName,
  includeSmsOptInPrompt = false,
  unsubscribeUrl = "{{unsubscribe_url}}",
}: WelcomeTemplateInput) {
  if (isValidFoundingNumber(foundingNumber)) {
    return foundingWelcomeEmailText({
      appBaseUrl,
      foundingNumber,
      firstName,
      unsubscribeUrl,
    });
  }

  const name = normalizeFirstName(firstName);
  const feedback = feedbackEmail();
  const smsPrompt = includeSmsOptInPrompt
    ? `\n\n---\n\n${smsOptInPromptText(appBaseUrl)}`
    : "";

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

SuppVis${smsPrompt}

${WELCOME_EMAIL_UNSUBSCRIBE_PLACEHOLDER}
Unsubscribe: ${unsubscribeUrl}`;
}

export function buildWelcomeEmailHtml({
  appBaseUrl,
  foundingNumber,
  firstName,
  includeSmsOptInPrompt = false,
  unsubscribeUrl = "{{unsubscribe_url}}",
}: WelcomeTemplateInput) {
  if (isValidFoundingNumber(foundingNumber)) {
    return foundingWelcomeEmailHtml({
      appBaseUrl,
      foundingNumber,
      firstName,
      unsubscribeUrl,
    });
  }

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
    includeSmsOptInPrompt ? smsOptInPromptHtml(appBaseUrl) : "",
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
  appBaseUrl,
  foundingNumber,
  firstName,
  unsubscribeUrl = "{{unsubscribe_url}}",
}: WelcomeTemplateInput) {
  if (isValidFoundingNumber(foundingNumber)) {
    return foundingWelcomeEmailText({
      appBaseUrl,
      foundingNumber,
      firstName,
      unsubscribeUrl,
    });
  }

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
  foundingNumber,
  firstName,
  unsubscribeUrl = "{{unsubscribe_url}}",
  appBaseUrl,
}: WelcomeTemplateInput) {
  if (isValidFoundingNumber(foundingNumber)) {
    return foundingWelcomeEmailHtml({
      appBaseUrl,
      foundingNumber,
      firstName,
      unsubscribeUrl,
    });
  }

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
