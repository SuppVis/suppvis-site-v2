export const SMS_CONSENT_VERSION = "2026-07-21-v3";

export const SMS_INFORMATIONAL_CONSENT_COPY =
  "I agree to receive recurring customer care and account-related text messages from SuppVis about my beta waitlist status, beta access instructions, onboarding assistance, account status updates, requested support responses, and service-related notifications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is optional and is not required to join the SuppVis beta waitlist, create an account, or use SuppVis services. See our Terms of Service and Privacy Policy.";

export type SmsConsentCategory = "informational";

export function getSmsConsentCategory(input: {
  informational: boolean;
  marketing: boolean;
}): SmsConsentCategory | null {
  if (input.informational) {
    return "informational";
  }

  return null;
}
