import type {
  CatalogProductBrowserSummaryDto,
  CatalogProductDetailDto,
  CatalogProductStatus,
  CatalogProductType,
} from "./contracts.generated";

export type CatalogDatabaseSortKey =
  | "product"
  | "brand"
  | "type"
  | "status"
  | "identity"
  | "barcodes"
  | "ingredients"
  | "evidence"
  | "followUp"
  | "updated";

export type CatalogDatabaseSort = {
  key: CatalogDatabaseSortKey;
  direction: "ascending" | "descending";
} | null;

export const defaultCatalogDatabaseSort: CatalogDatabaseSort = {
  key: "updated",
  direction: "descending",
};

export type CatalogDatabaseFilters = {
  query: string;
  status: CatalogProductStatus | "all";
  productType: CatalogProductType | "all";
  review: "all" | "needs-review" | "clear";
  evidence: "all" | "present" | "missing";
};

export const defaultCatalogDatabaseFilters: CatalogDatabaseFilters = {
  query: "",
  status: "all",
  productType: "all",
  review: "all",
  evidence: "all",
};

const sortKeys = new Set<CatalogDatabaseSortKey>([
  "product", "brand", "type", "status", "identity", "barcodes",
  "ingredients", "evidence", "followUp", "updated",
]);

export function catalogPrimaryIdentity(product: CatalogProductBrowserSummaryDto) {
  if (product.primaryCanonicalKey) return product.primaryCanonicalKey;
  return product.productType === "blend" ? "Multiple ingredients" : "Not in research library";
}

export function catalogEvidenceSummary(product: CatalogProductBrowserSummaryDto) {
  return product.imageCount === 0
    ? "No evidence"
    : `${product.imageCount} image${product.imageCount === 1 ? "" : "s"}`;
}

export function canOpenCatalogWorkspace(product: Pick<CatalogProductDetailDto, "status">) {
  return product.status === "draft";
}

export function nextCatalogDatabaseSort(
  current: CatalogDatabaseSort,
  key: CatalogDatabaseSortKey,
): CatalogDatabaseSort {
  if (current?.key !== key) return { key, direction: "ascending" };
  if (current.direction === "ascending") return { key, direction: "descending" };
  return null;
}

export function catalogDatabaseStateFromParams(params: Pick<URLSearchParams, "get">): {
  filters: CatalogDatabaseFilters;
  sort: CatalogDatabaseSort;
} {
  const status = params.get("status");
  const productType = params.get("type");
  const review = params.get("review");
  const evidence = params.get("evidence");
  const sortBy = params.get("sort");
  const direction = params.get("direction");
  return {
    filters: {
      query: params.get("q") ?? "",
      status: status === "draft" || status === "published" || status === "retired" ? status : "all",
      productType: productType === "supplement" || productType === "blend" ? productType : "all",
      review: review === "needs-review" || review === "clear" ? review : "all",
      evidence: evidence === "present" || evidence === "missing" ? evidence : "all",
    },
    sort: sortBy && sortKeys.has(sortBy as CatalogDatabaseSortKey)
      && (direction === "ascending" || direction === "descending")
      ? { key: sortBy as CatalogDatabaseSortKey, direction }
      : sortBy === "none" ? null : defaultCatalogDatabaseSort,
  };
}

export function catalogDatabaseHasActiveFilters(filters: CatalogDatabaseFilters) {
  return filters.query.trim().length > 0
    || filters.status !== "all"
    || filters.productType !== "all"
    || filters.review !== "all"
    || filters.evidence !== "all";
}

export function catalogDatabaseUrlParams(
  current: URLSearchParams,
  filters: CatalogDatabaseFilters,
  sort: CatalogDatabaseSort,
) {
  const params = new URLSearchParams(current);
  params.set("view", "database");
  params.delete("product");
  const values: Array<[string, string]> = [
    ["q", filters.query.trim()],
    ["status", filters.status === "all" ? "" : filters.status],
    ["type", filters.productType === "all" ? "" : filters.productType],
    ["review", filters.review === "all" ? "" : filters.review],
    ["evidence", filters.evidence === "all" ? "" : filters.evidence],
    // Explicitly preserve no-sort selections instead of restoring the default on reload.
    ["sort", sort?.key ?? "none"],
    ["direction", sort?.direction ?? ""],
  ];
  values.forEach(([key, value]) => {
    if (value) params.set(key, value);
    else params.delete(key);
  });
  return params;
}
