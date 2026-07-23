import {
  canSendSmsToSubscriber,
  listSmsSubscribersForAnnouncement,
  type CampaignAudienceCount,
  type SmsSubscriberRecord,
} from "../persistence";

export type SmsCampaignAudienceCandidate = {
  decision:
    | {
        eligible: true;
        normalizedPhone: string;
      }
    | {
        eligible: false;
        reason: string;
      };
  subscriber: SmsSubscriberRecord;
};

export type SmsCampaignAudience = CampaignAudienceCount & {
  candidates: SmsCampaignAudienceCandidate[];
};

function decideSmsAnnouncementEligibility(
  subscriber: SmsSubscriberRecord,
  seenPhones: Set<string>,
): SmsCampaignAudienceCandidate["decision"] {
  const normalizedPhone = subscriber.phone_number_e164;

  if (!/^\+\d{8,15}$/.test(normalizedPhone)) {
    return { eligible: false, reason: "invalid_phone" };
  }

  if (seenPhones.has(normalizedPhone)) {
    return { eligible: false, reason: "duplicate_phone" };
  }

  seenPhones.add(normalizedPhone);

  if (
    subscriber.status === "unsubscribed" ||
    subscriber.status === "opt_out_provider" ||
    subscriber.sms_global_opt_out
  ) {
    return { eligible: false, reason: "sms_opted_out" };
  }

  if (subscriber.status === "failed" || subscriber.status === "invalid") {
    return { eligible: false, reason: "sms_suppressed" };
  }

  if (!subscriber.sms_informational_consent) {
    return { eligible: false, reason: "missing_informational_consent" };
  }

  if (!canSendSmsToSubscriber(subscriber, "informational")) {
    return { eligible: false, reason: "not_sendable" };
  }

  return { eligible: true, normalizedPhone };
}

export async function buildSmsCampaignAudience(): Promise<SmsCampaignAudience> {
  const subscribers = await listSmsSubscribersForAnnouncement();
  const seenPhones = new Set<string>();
  const candidates = subscribers.map((subscriber) => ({
    subscriber,
    decision: decideSmsAnnouncementEligibility(subscriber, seenPhones),
  }));
  const eligibleCount = candidates.filter(
    (candidate) => candidate.decision.eligible,
  ).length;
  const duplicateCount = candidates.filter(
    (candidate) =>
      !candidate.decision.eligible &&
      candidate.decision.reason === "duplicate_phone",
  ).length;

  return {
    candidates,
    eligibleCount,
    excludedCount: candidates.length - eligibleCount,
    duplicateCount,
  };
}
