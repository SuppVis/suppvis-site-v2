export type ServingSizeReviewStatus =
  | "pending"
  | "escalated"
  | "confirmed_correct"
  | "corrected"
  | "multiple_contexts"
  | "removed_duplicate"
  | "canonical_selected"
  | "canonical_corrected";

export type ServingSizeReviewOutcome = Exclude<ServingSizeReviewStatus, "pending">;

export type DsldServingSize = {
  order: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  unit: string | null;
  notes: string | null;
  inSFB: boolean | null;
};

export type ServingSizeWarningSeverity = "high" | "medium" | "low" | "none";

export type DsldIngredientQuantity = {
  sourceQuantityIndex: number;
  servingSizeOrder: number | null;
  servingSizeQuantity: number | null;
  servingSizeUnit: string | null;
  operator: string | null;
  quantity: number | null;
  unit: string | null;
  dailyValueTargetGroup: Array<{
    name: string | null;
    operator: string | null;
    percent: number | null;
    footnote: string | null;
  }>;
};

export type ServingSizeIngredientRow = {
  rowPath: string;
  rowOrder: number | null;
  ingredientId: number | null;
  name: string;
  ancestorNames: string[];
  description: string | null;
  notes: string | null;
  quantities: DsldIngredientQuantity[];
};

export type RepeatedIngredientNameGroup = {
  normalizedName: string;
  printedNames: string[];
  rowPaths: string[];
};

export type ServingSizeQuantityOverride = {
  rowPath: string;
  selectedQuantityIndex: number | null;
};

export type ReviewedServingContext = {
  contextKey: string;
  sourceServingOrders: number[];
  householdQuantityMin: number | null;
  householdQuantityMax: number | null;
  householdUnit: string | null;
  metricQuantityMin: number | null;
  metricQuantityMax: number | null;
  metricUnit: string | null;
  contextLabel: string | null;
  preparationContext: string | null;
  labelText: string | null;
};

export type ServingSizePrescreenFlag = {
  code: string;
  severity: Exclude<ServingSizeWarningSeverity, "none">;
  summary: string;
  evidence: Record<string, unknown>;
};

export type ServingSizeReviewTask = {
  id: string;
  queueOrdinal: number;
  dsldLabelId: number;
  labelName: string;
  brandName: string;
  offMarket: boolean;
  status: ServingSizeReviewStatus;
  revision: number;
  flagCodes: string[];
  warningSeverity: ServingSizeWarningSeverity;
  reviewReasonCodes: string[];
};

export type ServingSizeReviewDecision = {
  id: string;
  taskRevision: number;
  outcome: ServingSizeReviewOutcome;
  reviewedServingContexts: ReviewedServingContext[] | null;
  selectedServingOrder: number | null;
  quantityOverrides: ServingSizeQuantityOverride[] | null;
  reviewerNote: string | null;
  reviewerEmail: string;
  decidedAt: string;
};

export type ServingSizeReviewTaskDetail = ServingSizeReviewTask & {
  sourceCandidateSha256: string;
  productType: Record<string, unknown> | null;
  labelPdfUrl: string;
  sourceServingSizes: DsldServingSize[];
  sourceContexts: ReviewedServingContext[];
  reviewedServingContexts: ReviewedServingContext[] | null;
  policySuggestedServingOrder: number | null;
  policySelectionRule: string | null;
  sourceIngredientRows: ServingSizeIngredientRow[];
  repeatedIngredientNameGroups: RepeatedIngredientNameGroup[];
  selectedServingOrder: number | null;
  quantityOverrides: ServingSizeQuantityOverride[] | null;
  prescreenFlags: ServingSizePrescreenFlag[];
  decisions: ServingSizeReviewDecision[];
};

export type ServingSizeReviewProgress = {
  total: number;
  pending: number;
  escalated: number;
  decided: number;
};

type ReviewListResponse = {
  batchKey: string;
  tasks: ServingSizeReviewTask[];
  progress: ServingSizeReviewProgress;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.error?.message;
    throw new Error(typeof message === "string" ? message : `Serving-size review failed (${response.status}).`);
  }
  return result as T;
}

export const getServingSizeReviewList = () => request<ReviewListResponse>(
  "/api/admin/catalog/serving-size-review",
);

export const getServingSizeReviewTask = (taskId: string) => request<ServingSizeReviewTaskDetail>(
  `/api/admin/catalog/serving-size-review/tasks/${encodeURIComponent(taskId)}`,
);

export const saveServingSizeReviewDecision = (
  taskId: string,
  body: Record<string, unknown>,
) => request<ServingSizeReviewTaskDetail>(
  `/api/admin/catalog/serving-size-review/tasks/${encodeURIComponent(taskId)}/decisions`,
  { method: "POST", body: JSON.stringify(body) },
);
