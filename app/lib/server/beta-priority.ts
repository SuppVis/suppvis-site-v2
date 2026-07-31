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

export function compareForSignupOrderBackfill<
  T extends {
    created_at?: string;
    id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    normalized_email?: string;
    signup_order_assigned_at?: string;
  },
>(a: T, b: T) {
  const leftTimestamp = a.created_at || a.signup_order_assigned_at || "";
  const rightTimestamp = b.created_at || b.signup_order_assigned_at || "";
  const createdCompare = leftTimestamp.localeCompare(rightTimestamp);

  if (createdCompare !== 0) {
    return createdCompare;
  }

  const idCompare = (a.id || "").localeCompare(b.id || "");

  if (idCompare !== 0) {
    return idCompare;
  }

  return (a.normalized_email || a.email || "").localeCompare(
    b.normalized_email || b.email || "",
  );
}
