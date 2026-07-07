import { normalizeDisplayName } from "../validation";

export const TESTFLIGHT_BETA_URL =
  "https://testflight.apple.com/join/nTASgewZ";

export const WELCOME_EMAIL_SUBJECT = "You're in. Welcome to SuppVis.";

export const WELCOME_EMAIL_PREVIEW_TEXT =
  "Get beta access and complete onboarding to unlock SuppVis.";

export const WELCOME_EMAIL_UNSUBSCRIBE_PLACEHOLDER =
  "You're receiving this because you joined the SuppVis beta waitlist. You can unsubscribe at any time.";

export const WELCOME_SMS_TEMPLATE =
  "Welcome to SuppVis. You're one of our founding beta members. We're two brothers who built SuppVis to show what your supplements are actually doing - backed by research, not hype. Get access: https://testflight.apple.com/join/nTASgewZ Complete onboarding to unlock everything. Reply STOP to unsubscribe.";

export const WELCOME_EMAIL_ENABLED_ENV = "WELCOME_EMAIL_ENABLED";
export const WELCOME_SMS_ENABLED_ENV = "WELCOME_SMS_ENABLED";

type WelcomeTemplateInput = {
  firstName: string;
  unsubscribeUrl?: string;
};

type UnsubscribeUrlInput = {
  appBaseUrl?: string;
  subscriberId: string;
  token: string;
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

export function isWelcomeEmailEnabled() {
  return process.env[WELCOME_EMAIL_ENABLED_ENV] === "true";
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

export function buildWelcomeEmailText({
  firstName,
  unsubscribeUrl = "{{unsubscribe_url}}",
}: WelcomeTemplateInput) {
  const name = normalizeFirstName(firstName);

  return `Hey ${name},

Welcome to SuppVis. Right now you're one of a small group of founding members getting in before anyone else, and we're genuinely glad you're here.

Here's the short version of why this exists. Most people take supplements on faith and never actually know if they're working. We're two brothers who got tired of guessing, so we built SuppVis to do one thing well: show you what's actually working for your body, and flag anything that could interact with your medications or conditions. All of it grounded in research, none of it influencer hype.

You're seeing the beta, which means you're seeing it early, and a little rough in places. That's the point. This founding group shapes what SuppVis becomes, and the things you notice and tell us are what make it better before we open it to everyone.

Follow this link to get access to the beta:
${TESTFLIGHT_BETA_URL}

It'll walk you through setup. The one thing we'd ask: complete the full onboarding when you get in. That's what unlocks the personalized side of SuppVis, and it's where the whole thing comes to life for you.

Thank you for trusting us this early. It means more than you know.

Tanner and Connor

SuppVis

${WELCOME_EMAIL_UNSUBSCRIBE_PLACEHOLDER}
Unsubscribe: ${unsubscribeUrl}`;
}

export function buildWelcomeEmailHtml({
  firstName,
  unsubscribeUrl = "{{unsubscribe_url}}",
}: WelcomeTemplateInput) {
  const name = escapeHtml(normalizeFirstName(firstName));
  const unsubscribeHref = escapeHtml(unsubscribeUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${WELCOME_EMAIL_SUBJECT}</title>
  </head>
  <body style="margin:0;background:#0A0F14;color:#F0F4F8;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${WELCOME_EMAIL_PREVIEW_TEXT}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F14;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 18px 0;text-align:left;">
                <div style="font-size:24px;line-height:1;font-weight:800;letter-spacing:0;color:#F0F4F8;">SuppVis</div>
              </td>
            </tr>
            <tr>
              <td style="background:#0D1117;border:1px solid rgba(20,184,166,0.22);border-radius:18px;padding:34px 28px;box-shadow:0 18px 50px rgba(0,0,0,0.28);">
                <h1 style="margin:0 0 22px 0;color:#F0F4F8;font-size:28px;line-height:1.15;font-weight:800;">You're in.</h1>
                <p style="margin:0 0 18px 0;color:#D9E2EA;font-size:16px;line-height:1.65;">Hey ${name},</p>
                <p style="margin:0 0 18px 0;color:#9BAFBF;font-size:16px;line-height:1.65;">Welcome to SuppVis. Right now you're one of a small group of founding members getting in before anyone else, and we're genuinely glad you're here.</p>
                <p style="margin:0 0 18px 0;color:#9BAFBF;font-size:16px;line-height:1.65;">Here's the short version of why this exists. Most people take supplements on faith and never actually know if they're working. We're two brothers who got tired of guessing, so we built SuppVis to do one thing well: show you what's actually working for your body, and flag anything that could interact with your medications or conditions. All of it grounded in research, none of it influencer hype.</p>
                <p style="margin:0 0 18px 0;color:#9BAFBF;font-size:16px;line-height:1.65;">You're seeing the beta, which means you're seeing it early, and a little rough in places. That's the point. This founding group shapes what SuppVis becomes, and the things you notice and tell us are what make it better before we open it to everyone.</p>
                <p style="margin:0 0 22px 0;color:#9BAFBF;font-size:16px;line-height:1.65;">Follow this link to get access to the beta:</p>
                <p style="margin:0 0 18px 0;text-align:center;">
                  <a href="${TESTFLIGHT_BETA_URL}" style="display:inline-block;border-radius:999px;background:#14B8A6;color:#0A0F14;text-decoration:none;font-size:16px;font-weight:800;padding:14px 24px;">Open TestFlight beta</a>
                </p>
                <p style="margin:0 0 22px 0;color:#9BAFBF;font-size:13px;line-height:1.55;word-break:break-all;text-align:center;">${TESTFLIGHT_BETA_URL}</p>
                <p style="margin:0 0 18px 0;color:#9BAFBF;font-size:16px;line-height:1.65;">It'll walk you through setup. The one thing we'd ask: complete the full onboarding when you get in. That's what unlocks the personalized side of SuppVis, and it's where the whole thing comes to life for you.</p>
                <p style="margin:0 0 24px 0;color:#9BAFBF;font-size:16px;line-height:1.65;">Thank you for trusting us this early. It means more than you know.</p>
                <p style="margin:0;color:#D9E2EA;font-size:16px;line-height:1.65;">Tanner and Connor<br />SuppVis</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 8px 0 8px;text-align:center;color:#5A7089;font-size:12px;line-height:1.6;">
                ${WELCOME_EMAIL_UNSUBSCRIBE_PLACEHOLDER}
                <br />
                <a href="${unsubscribeHref}" style="color:#14B8A6;text-decoration:underline;">Unsubscribe</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
