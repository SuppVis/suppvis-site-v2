import type {
  AttachCatalogBarcodeRequest,
  CatalogApiErrorResponse,
  CatalogBarcodeDecodeResponse,
  CatalogBarcodeInput,
  CatalogBarcodeLookupResponse,
  CatalogCanonicalSupplementSearchResponse,
  CatalogFormulaTemplateCandidate,
  CatalogFrontLabelTemplateResponse,
  CatalogImageRole,
  CatalogProductBrowserSummaryDto,
  CatalogProductDetailDto,
  CatalogProductStatus,
  CatalogProductSearchResponse,
  CatalogPublicTemplateResponse,
  CatalogTemplateDiffResponse,
  CatalogUploadRequest,
  CatalogUploadResponse,
  CreateCatalogProductRequest,
  ReassignCatalogBarcodeRequest,
  UpdateCatalogProductRequest,
} from "./contracts.generated";

export class CatalogApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  readonly details?: CatalogApiErrorResponse["error"]["details"];

  constructor(status: number, body: CatalogApiErrorResponse | null) {
    super(body?.error.message ?? "The catalog request could not be completed.");
    this.name = "CatalogApiError";
    this.status = status;
    this.code = body?.error.code ?? "INTERNAL_ERROR";
    this.field = body?.error.field;
    this.details = body?.error.details;
  }
}

async function catalogRequest<ResponseBody>(
  path: string,
  options: RequestInit = {},
): Promise<ResponseBody> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let body: ResponseBody | CatalogApiErrorResponse | null = null;
  try {
    body = await response.json() as ResponseBody | CatalogApiErrorResponse;
  } catch {
    body = null;
  }
  if (!response.ok) throw new CatalogApiError(response.status, body as CatalogApiErrorResponse | null);
  if (body === null) throw new CatalogApiError(response.status, null);
  return body as ResponseBody;
}

function queryString(values: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function searchCatalogProducts(input: {
  q?: string;
  exactLabelName?: string;
  exactBrandName?: string;
  status?: CatalogProductStatus | "all";
  canonicalKey?: string;
  brandName?: string;
  needsFollowUp?: boolean;
  followUpReason?: string;
  evidence?: "present" | "missing";
  sortBy?: "product" | "brand" | "type" | "status" | "identity" | "barcodes" | "ingredients" | "evidence" | "followUp" | "updated";
  sortDirection?: "ascending" | "descending";
  productType?: string;
  cursor?: string;
  limit?: number;
}) {
  return catalogRequest<CatalogProductSearchResponse<CatalogProductBrowserSummaryDto>>(
    `/api/admin/catalog/products/search${queryString({ ...input, view: "summary", limit: input.limit ?? 30 })}`,
  );
}

export function getCatalogProduct(productId: string) {
  return catalogRequest<CatalogProductDetailDto>(
    `/api/admin/catalog/products/${encodeURIComponent(productId)}`,
  );
}

export function searchCanonicalSupplements(q: string) {
  return catalogRequest<CatalogCanonicalSupplementSearchResponse>(
    `/api/admin/catalog/canonical-supplements${queryString({ q, limit: 12 })}`,
  );
}

export function lookupCatalogBarcode(barcode: CatalogBarcodeInput) {
  return catalogRequest<CatalogBarcodeLookupResponse>(
    `/api/admin/catalog/barcodes/${encodeURIComponent(barcode.value)}${queryString({ format: barcode.format })}`,
  );
}

export function createCatalogProduct(input: CreateCatalogProductRequest) {
  return catalogRequest<{ product: CatalogProductDetailDto }>("/api/admin/catalog/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCatalogProduct(productId: string, input: UpdateCatalogProductRequest) {
  return catalogRequest<{ product: CatalogProductDetailDto }>(
    `/api/admin/catalog/products/${encodeURIComponent(productId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function attachCatalogBarcode(productId: string, input: AttachCatalogBarcodeRequest) {
  return catalogRequest<{ product: CatalogProductDetailDto }>(
    `/api/admin/catalog/products/${encodeURIComponent(productId)}/barcodes`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function reassignCatalogBarcode(gtin14: string, input: ReassignCatalogBarcodeRequest) {
  return catalogRequest<{ product: CatalogProductDetailDto }>(
    `/api/admin/catalog/barcodes/${encodeURIComponent(gtin14)}/assignment`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function requestCatalogUploads(input: CatalogUploadRequest) {
  return catalogRequest<CatalogUploadResponse>("/api/admin/catalog/images/uploads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sha256File(file: File) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function putCatalogUpload(
  file: File,
  upload: CatalogUploadResponse["uploads"][number],
) {
  const response = await fetch(upload.uploadUrl, {
    method: upload.method,
    body: file,
    headers: upload.requiredHeaders,
  });
  if (!response.ok) throw new Error(`Private image upload failed (${response.status}).`);
}

export function getCatalogImageAccess(imageId: string) {
  return catalogRequest<{ url: string; expiresAt: string }>(
    `/api/admin/catalog/images/${encodeURIComponent(imageId)}/access`,
    { method: "POST", body: "{}" },
  );
}

export function getFrontLabelTemplate(imageUploadHandles: string[]) {
  return catalogRequest<CatalogFrontLabelTemplateResponse>(
    "/api/admin/catalog/templates/front-label",
    { method: "POST", body: JSON.stringify({ imageUploadHandles }) },
  );
}

export function decodeBarcodeImage(imageUploadHandle: string) {
  return catalogRequest<CatalogBarcodeDecodeResponse>(
    "/api/admin/catalog/templates/barcode",
    { method: "POST", body: JSON.stringify({ imageUploadHandles: [imageUploadHandle] }) },
  );
}

export function getOcrTemplate(imageUploadHandles: string[]) {
  return catalogRequest<{ candidate: CatalogFormulaTemplateCandidate }>(
    "/api/admin/catalog/templates/ocr",
    { method: "POST", body: JSON.stringify({ imageUploadHandles }) },
  );
}

export function getPublicTemplates(barcode: CatalogBarcodeInput) {
  return catalogRequest<CatalogPublicTemplateResponse>(
    "/api/admin/catalog/templates/public",
    { method: "POST", body: JSON.stringify({ barcode }) },
  );
}

export function getTemplateDiff(
  productId: string,
  expectedRevision: number,
  candidate: CatalogFormulaTemplateCandidate,
) {
  return catalogRequest<CatalogTemplateDiffResponse>(
    `/api/admin/catalog/products/${encodeURIComponent(productId)}/template-diff`,
    { method: "POST", body: JSON.stringify({ expectedRevision, candidate }) },
  );
}

export type UploadableCatalogFile = {
  clientId: string;
  file: File;
  role: CatalogImageRole;
};
