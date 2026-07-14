import type { EmailSubscriberRecord } from "../persistence";

const EMAIL_MAX_LENGTH = 254;

export type CampaignRecipientDecision =
  | {
      eligible: true;
      normalizedEmail: string;
    }
  | {
      eligible: false;
      reason:
        | "not_subscribed"
        | "missing_email"
        | "invalid_email"
        | "missing_unsubscribe_token"
        | "missing_consent"
        | "duplicate_email";
    };

function isValidEmailAddress(email: string) {
  return (
    email.length <= EMAIL_MAX_LENGTH &&
    /^[^\s@]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
      email,
    )
  );
}

export function decideCampaignRecipientEligibility(
  subscriber: EmailSubscriberRecord,
  seenEmails: Set<string>,
): CampaignRecipientDecision {
  if (subscriber.status !== "subscribed") {
    return { eligible: false, reason: "not_subscribed" };
  }

  const normalizedEmail = subscriber.normalized_email.trim().toLowerCase();

  if (!normalizedEmail) {
    return { eligible: false, reason: "missing_email" };
  }

  if (!isValidEmailAddress(normalizedEmail)) {
    return { eligible: false, reason: "invalid_email" };
  }

  if (!subscriber.unsubscribe_token?.trim()) {
    return { eligible: false, reason: "missing_unsubscribe_token" };
  }

  if (!subscriber.consent_timestamp || !subscriber.consent_source) {
    return { eligible: false, reason: "missing_consent" };
  }

  if (seenEmails.has(normalizedEmail)) {
    return { eligible: false, reason: "duplicate_email" };
  }

  seenEmails.add(normalizedEmail);

  return {
    eligible: true,
    normalizedEmail,
  };
}
