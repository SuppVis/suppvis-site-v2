import { decideCampaignRecipientEligibility } from "./campaign-eligibility";
import {
  getBetaAudienceMembership,
} from "@/app/lib/server/beta-subscribers";
import type { BetaAudienceSegment } from "@/app/lib/server/beta-priority";
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

export async function buildCampaignAudience(input?: {
  audienceSegment?: BetaAudienceSegment;
}): Promise<CampaignAudience> {
  const subscribers = await listEmailSubscribersByStatus([
    "subscribed",
    "unsubscribed",
    "bounced",
    "complained",
  ]);
  const membership = await getBetaAudienceMembership(
    input?.audienceSegment || "all",
  );
  const seenEmails = new Set<string>();
  const candidates = subscribers.map((subscriber) => ({
    subscriber,
    decision:
      membership && !membership.emails.has(subscriber.normalized_email)
        ? ({ eligible: false, reason: "outside_audience_segment" } as const)
        : decideCampaignRecipientEligibility(subscriber, seenEmails),
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
    totalCount: candidates.length,
    eligibleCount,
    excludedCount: candidates.length - eligibleCount,
    duplicateCount,
  };
}
