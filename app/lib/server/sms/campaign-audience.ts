import {
  getBetaAudienceMembership,
} from "@/app/lib/server/beta-subscribers";
import type { BetaAudienceSegment } from "@/app/lib/server/beta-priority";
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

export async function buildSmsCampaignAudience(input?: {
  audienceSegment?: BetaAudienceSegment;
  customSubscriberIds?: string[];
}): Promise<SmsCampaignAudience> {
  const subscribers = await listSmsSubscribersForAnnouncement();
  const membership = await getBetaAudienceMembership(
    input?.audienceSegment || "all",
    { customSubscriberIds: input?.customSubscriberIds },
  );
  const seenPhones = new Set<string>();
  const candidates = subscribers.map((subscriber) => ({
    subscriber,
    decision:
      membership && !membership.phones.has(subscriber.phone_number_e164)
        ? ({ eligible: false, reason: "outside_audience_segment" } as const)
        : decideSmsAnnouncementEligibility(subscriber, seenPhones),
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
    totalCount: candidates.length,
    eligibleCount,
    excludedCount: candidates.length - eligibleCount,
    duplicateCount,
  };
}
