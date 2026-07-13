export const SMS_CONSENT_VERSION = "2026-07-11-v2";

export const SMS_INFORMATIONAL_CONSENT_COPY =
  "I agree to receive recurring informational text messages from SuppVis about my beta waitlist status, beta access, account or service notifications, and customer support updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not required to join the SuppVis beta waitlist or use SuppVis services. See our Terms of Service and Privacy Policy.";

export const SMS_MARKETING_CONSENT_COPY =
  "I agree to receive recurring marketing and promotional text messages from SuppVis about product and feature announcements, SuppVis news, beta program invitations, special offers, and promotions. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not required to join the SuppVis beta waitlist or use SuppVis services. See our Terms of Service and Privacy Policy.";

export type SmsConsentCategory = "informational" | "marketing" | "both";

export function getSmsConsentCategory(input: {
  informational: boolean;
  marketing: boolean;
}): SmsConsentCategory | null {
  if (input.informational && input.marketing) {
    return "both";
  }

  if (input.informational) {
    return "informational";
  }

  if (input.marketing) {
    return "marketing";
  }

  return null;
}
