import type {
  CatalogProductBrowserSummaryDto,
  CatalogProductDetailDto,
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

const catalogSortCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

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

function catalogSortValue(
  product: CatalogProductBrowserSummaryDto,
  key: CatalogDatabaseSortKey,
): string | number {
  switch (key) {
    case "product": return `${product.labelName}\u0000${product.variant ?? ""}`;
    case "brand": return product.brandName;
    case "type": return product.productType;
    case "status": return product.status;
    case "identity": return catalogPrimaryIdentity(product);
    case "barcodes": return product.barcodeCount;
    case "ingredients": return product.activeLeafCount;
    case "evidence": return product.imageCount;
    case "followUp": return product.needsFollowUp ? 1 : 0;
    case "updated": return Date.parse(product.updatedAt);
  }
}

export function sortCatalogDatabaseProducts(
  products: CatalogProductBrowserSummaryDto[],
  sort: CatalogDatabaseSort,
) {
  if (!sort) return products;
  const multiplier = sort.direction === "ascending" ? 1 : -1;
  return products
    .map((product, originalIndex) => ({ product, originalIndex }))
    .sort((left, right) => {
      const leftValue = catalogSortValue(left.product, sort.key);
      const rightValue = catalogSortValue(right.product, sort.key);
      const comparison = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : catalogSortCollator.compare(String(leftValue), String(rightValue));
      return comparison === 0
        ? left.originalIndex - right.originalIndex
        : comparison * multiplier;
    })
    .map(({ product }) => product);
}
