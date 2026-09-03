import type {
  CatalogProductBrowserSummaryDto,
  CatalogProductDetailDto,
} from "./contracts.generated";

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
