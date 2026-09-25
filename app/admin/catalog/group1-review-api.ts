export type ReviewStatus = 'pending' | 'escalated' | 'accepted' | 'not_group1' | 'not_real_data_row';
export type ReviewOutcome = Exclude<ReviewStatus, 'pending'>;

export type ReviewField = { fieldKey: string; displayName: string; sortOrder: number };
export type ReviewTask = {
  id: string;
  dsldLabelId: number;
  sourceJsonPath: string;
  printedName: string;
  suggestedFieldKey: string;
  suggestedFieldName: string;
  selectedFieldKey: string | null;
  labelName: string;
  brandName: string;
  status: ReviewStatus;
  revision: number;
};
export type SourceQuantity = {
  operator?: string;
  quantity?: number | null;
  unit?: string | null;
  servingSizeQuantity?: number | null;
  servingSizeUnit?: string | null;
  dailyValueTargetGroup?: Array<{ name?: string; percent?: number | null; operator?: string }>;
};
export type ReviewDecision = {
  taskRevision: number;
  outcome: ReviewOutcome;
  selectedFieldKey: string | null;
  reviewerEmail: string;
  reviewerNote: string | null;
  correctionReason: string | null;
  correctedValues: Array<{ quantityIndex: number; amount: number | null; unit: string | null; dailyValuePercents: Array<number | null> }> | null;
  decidedAt: string;
};
export type ReviewTaskDetail = ReviewTask & {
  sourceRow: { name?: string; quantity?: SourceQuantity[]; ingredientGroup?: string; category?: string; notes?: string };
  sourceRowSha256: string;
  sourceAncestorNames: string[];
  labelPdfUrl: string;
  decisions: ReviewDecision[];
};

type ReviewListResponse = { batchKey: string; fields: ReviewField[]; tasks: ReviewTask[] };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.error?.message;
    throw new Error(typeof message === 'string' ? message : `Review request failed (${response.status}).`);
  }
  return result as T;
}

export const getReviewList = () => request<ReviewListResponse>('/api/admin/catalog/group1-review');
export const getReviewTask = (taskId: string) => request<ReviewTaskDetail>(
  `/api/admin/catalog/group1-review/tasks/${encodeURIComponent(taskId)}`,
);
export const saveReviewDecision = (taskId: string, body: Record<string, unknown>) => request<ReviewTaskDetail>(
  `/api/admin/catalog/group1-review/tasks/${encodeURIComponent(taskId)}/decisions`,
  { method: 'POST', body: JSON.stringify(body) },
);
