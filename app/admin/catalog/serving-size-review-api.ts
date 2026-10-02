export type ServingSizeReviewStatus =
  | "pending"
  | "escalated"
  | "confirmed_correct"
  | "corrected"
  | "multiple_contexts"
  | "removed_duplicate";

export type ServingSizeReviewOutcome = Exclude<ServingSizeReviewStatus, "pending">;

export type DsldServingSize = {
  order: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  unit: string | null;
  notes: string | null;
  inSFB: boolean | null;
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
  severity: "high" | "medium";
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
};

export type ServingSizeReviewDecision = {
  id: string;
  taskRevision: number;
  outcome: ServingSizeReviewOutcome;
  reviewedServingContexts: ReviewedServingContext[] | null;
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
