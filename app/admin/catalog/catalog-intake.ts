import type { CatalogBarcodeFormat, CatalogBarcodeLookupResponse, CatalogImageRole } from "./contracts.generated";

export type SourceState = "undecided" | "processing" | "ready" | "skipped" | "analysis_failed";
export type SourceStates = Record<CatalogImageRole, SourceState>;
export type BarcodeDraft = {
  value: string;
  format: CatalogBarcodeFormat;
  confirmed: boolean;
  packageLabel: string;
  packageAmount: string;
  packageUnit: string;
};
export const emptyBarcode = (): BarcodeDraft => ({ value: "", format: "upc_a", confirmed: false, packageLabel: "", packageAmount: "", packageUnit: "" });
export const emptySources = (): SourceStates => ({ barcode: "undecided", front_label: "undecided", supplement_facts: "undecided" });

// Client pre-validation only. The platform independently validates the identity at lookup/save.
export function barcodeValidation(value: string, format: CatalogBarcodeFormat): string | null {
  if (!/^[0-9\s-]+$/.test(value)) return "Enter barcode digits (spaces and hyphens are allowed).";
  const digits = value.replace(/[^0-9]/g, "");
  const length = { upc_a: 12, upc_e: 8, ean_8: 8, ean_13: 13, gtin_14: 14 }[format];
  if (digits.length !== length) return `Expected ${length} digits for ${format.replaceAll("_", " ").toUpperCase()}.`;
  if (/^0+$/.test(digits)) return "An all-zero barcode is not valid.";
  let expanded = digits;
  if (format === "upc_e") {
    if (!/^[01]/.test(digits)) return "UPC-E must start with 0 or 1.";
    const d = digits.slice(1, 7);
    const last = d[5];
    const body = "012".includes(last) ? `${digits[0]}${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`
      : last === "3" ? `${digits[0]}${d.slice(0, 3)}00000${d[3]}${d[4]}`
      : last === "4" ? `${digits[0]}${d.slice(0, 4)}00000${d[4]}`
      : `${digits[0]}${d.slice(0, 5)}0000${last}`;
    expanded = body + digits[7];
  }
  let sum = 0;
  for (let i = expanded.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += Number(expanded[i]) * weight;
  return (10 - sum % 10) % 10 === Number(expanded.at(-1)) ? null : "The barcode check digit is invalid. Compare and correct the digits or format.";
}

export function barcodeInput(draft: BarcodeDraft) {
  return { value: draft.value.trim(), format: draft.format,
    packageSize: [draft.packageLabel, draft.packageAmount, draft.packageUnit].some((part) => part.trim())
      ? { labelText: draft.packageLabel.trim(), amount: Number(draft.packageAmount), unit: draft.packageUnit.trim() } : null };
}
export function barcodeBlockers(draft: BarcodeDraft, lookup: CatalogBarcodeLookupResponse | null) {
  const result: string[] = [];
  if (draft.value.trim()) {
    const invalid = barcodeValidation(draft.value, draft.format);
    if (invalid) result.push(invalid);
    if (!draft.confirmed) result.push("Confirm the decoded or manually entered barcode digits.");
    if (!lookup) result.push("Wait for the automatic barcode check to succeed.");
  }
  const parts = [draft.packageLabel.trim(), draft.packageAmount.trim(), draft.packageUnit.trim()];
  if (parts.some(Boolean) && (!parts.every(Boolean) || !Number.isFinite(Number(draft.packageAmount)) || Number(draft.packageAmount) <= 0)) result.push("Package size needs a label, positive amount, and unit, or must remain empty.");
  if (draft.packageLabel.trim().length > 160 || draft.packageUnit.trim().length > 40) result.push("Package-size label or unit exceeds the catalog limit.");
  return result;
}
export function sourcesResolved(sources: SourceStates) {
  return Object.values(sources).every((state) => state === "ready" || state === "skipped");
}
export function identityKey(labelName: string, brandName: string) {
  return JSON.stringify([labelName.trim().toLowerCase(), brandName.trim().toLowerCase()]);
}
export const identifyingFactors = [
  "Brand/manufacturer matches",
  "Exact product name and product line match",
  "Variant, flavor, and dosage form match",
  "Serving size and serving basis match",
  "All formula ingredients and amounts match",
  "Nutrition composition matches",
] as const;
export function allFactorsConfirmed(checks: boolean[]) {
  return checks.length === identifyingFactors.length && checks.every(Boolean);
}
