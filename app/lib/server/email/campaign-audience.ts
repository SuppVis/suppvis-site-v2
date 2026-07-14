import { decideCampaignRecipientEligibility } from "./campaign-eligibility";
import {
  listEmailSubscribersByStatus,
  type CampaignAudienceCount,
  type EmailSubscriberRecord,
} from "../persistence";

export type CampaignAudienceCandidate = {
  decision:
    | {
        eligible: true;
        normalizedEmail: string;
      }
    | {
        eligible: false;
        reason: string;
      };
  subscriber: EmailSubscriberRecord;
};

export type CampaignAudience = CampaignAudienceCount & {
  candidates: CampaignAudienceCandidate[];
};

export async function buildCampaignAudience(): Promise<CampaignAudience> {
  const subscribers = await listEmailSubscribersByStatus([
    "subscribed",
    "unsubscribed",
    "bounced",
    "complained",
  ]);
  const seenEmails = new Set<string>();
  const candidates = subscribers.map((subscriber) => ({
    subscriber,
    decision: decideCampaignRecipientEligibility(subscriber, seenEmails),
  }));
  const eligibleCount = candidates.filter(
    (candidate) => candidate.decision.eligible,
  ).length;
  const duplicateCount = candidates.filter(
    (candidate) =>
      !candidate.decision.eligible &&
      candidate.decision.reason === "duplicate_email",
  ).length;

  return {
    candidates,
    eligibleCount,
    excludedCount: candidates.length - eligibleCount,
    duplicateCount,
  };
}
