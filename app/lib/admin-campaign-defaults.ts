export const DEFAULT_ADMIN_EMAIL_BODY =
  "A new SuppVis beta update is ready. Open TestFlight to install the latest build, then reply with anything that feels confusing, broken, or surprisingly useful.";

export const DEFAULT_ADMIN_EMAIL_CTA_LABEL = "Open TestFlight";

export const DEFAULT_ADMIN_EMAIL_CTA_URL =
  "https://testflight.apple.com/join/nTASgewZ";

export const DEFAULT_ADMIN_EMAIL_HEADING = "A new beta build is ready.";

export const DEFAULT_ADMIN_EMAIL_SUBJECT = "New SuppVis beta update";

export const DEFAULT_ADMIN_MESSAGE_TYPE = "testflight_update";

export const DEFAULT_ADMIN_SMS_BODY =
  "Your beta update is ready. Open TestFlight to install the latest build: https://testflight.apple.com/join/nTASgewZ";

export function normalizedDefaultCandidate(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isDefaultAdminEmailContent(input: {
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  heading: string;
  messageType: string;
  subject: string;
}) {
  return (
    normalizedDefaultCandidate(input.body) ===
      normalizedDefaultCandidate(DEFAULT_ADMIN_EMAIL_BODY) &&
    normalizedDefaultCandidate(input.ctaLabel) ===
      normalizedDefaultCandidate(DEFAULT_ADMIN_EMAIL_CTA_LABEL) &&
    normalizedDefaultCandidate(input.ctaUrl) ===
      normalizedDefaultCandidate(DEFAULT_ADMIN_EMAIL_CTA_URL) &&
    normalizedDefaultCandidate(input.heading) ===
      normalizedDefaultCandidate(DEFAULT_ADMIN_EMAIL_HEADING) &&
    normalizedDefaultCandidate(input.messageType) ===
      normalizedDefaultCandidate(DEFAULT_ADMIN_MESSAGE_TYPE) &&
    normalizedDefaultCandidate(input.subject) ===
      normalizedDefaultCandidate(DEFAULT_ADMIN_EMAIL_SUBJECT)
  );
}

export function isDefaultAdminSmsContent(smsBody: string) {
  return (
    normalizedDefaultCandidate(smsBody) ===
    normalizedDefaultCandidate(DEFAULT_ADMIN_SMS_BODY)
  );
}

export function isUnsafeTestPlaceholder(value: string) {
  const normalized = normalizedDefaultCandidate(value);

  return (
    normalized.includes("test. ignore") ||
    normalized.includes("test ignore")
  );
}
