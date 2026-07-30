export type BetaAudienceSegment = "all" | "priority" | "standard";

export const BETA_AUDIENCE_SEGMENTS: BetaAudienceSegment[] = [
  "all",
  "priority",
  "standard",
];

export const DEFAULT_PRIORITY_BETA_LIMIT = 300;

export function getPriorityBetaLimit() {
  const raw =
    process.env.PRIORITY_BETA_LIMIT ||
    process.env.BETA_PRIORITY_LIMIT ||
    String(DEFAULT_PRIORITY_BETA_LIMIT);
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_PRIORITY_BETA_LIMIT;
  }

  return Math.min(parsed, 100_000);
}

export function normalizeBetaAudienceSegment(
  value: unknown,
): BetaAudienceSegment {
  return value === "priority" || value === "standard" ? value : "all";
}

export function betaAudienceSegmentLabel(segment: BetaAudienceSegment) {
  if (segment === "priority") {
    return "Priority beta subscribers";
  }

  if (segment === "standard") {
    return "Standard beta subscribers";
  }

  return "All beta subscribers";
}

export function betaAudienceSegmentAuditValue(segment: BetaAudienceSegment) {
  return segment === "all" ? "all_beta" : `${segment}_beta`;
}

export function priorityBadgeLabel(input: {
  isPriority: boolean;
  priorityLimit?: number;
}) {
  return input.isPriority
    ? `Priority - Top ${input.priorityLimit || getPriorityBetaLimit()}`
    : "Standard";
}

export function shouldAutoAssignPriority(signupOrderNumber: number) {
  return signupOrderNumber > 0 && signupOrderNumber <= getPriorityBetaLimit();
}

function preferredExistingSubscriberRank(input: {
  email?: string;
  firstName?: string;
  fullName?: string;
  lastName?: string;
}) {
  const searchable = [
    input.email,
    input.firstName,
    input.lastName,
    input.fullName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\bandrew\b/.test(searchable) || searchable.includes("andrew")) {
    return 0;
  }

  if (/\btanner\b/.test(searchable) || searchable.includes("tanner")) {
    return 1;
  }

  return 2;
}

export function compareForSignupOrderBackfill<
  T extends {
    created_at?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    normalized_email?: string;
  },
>(a: T, b: T) {
  const aRank = preferredExistingSubscriberRank({
    email: a.normalized_email || a.email,
    firstName: a.first_name,
    fullName: `${a.first_name || ""} ${a.last_name || ""}`.trim(),
    lastName: a.last_name,
  });
  const bRank = preferredExistingSubscriberRank({
    email: b.normalized_email || b.email,
    firstName: b.first_name,
    fullName: `${b.first_name || ""} ${b.last_name || ""}`.trim(),
    lastName: b.last_name,
  });

  if (aRank !== bRank) {
    return aRank - bRank;
  }

  const createdCompare = (a.created_at || "").localeCompare(b.created_at || "");

  if (createdCompare !== 0) {
    return createdCompare;
  }

  return (a.normalized_email || a.email || "").localeCompare(
    b.normalized_email || b.email || "",
  );
}
