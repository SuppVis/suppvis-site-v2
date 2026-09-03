// GENERATED PORTABLE CONTRACT: source authority is lib/adminCatalogContracts.ts.
// Keep this file byte-for-byte identical to the website generated snapshot.

export type CatalogProductType = 'supplement' | 'blend';
export type CatalogProductStatus = 'draft' | 'published' | 'retired';
export type CatalogGuidanceState = 'none' | 'structured' | 'unmappable';
export type CatalogLibraryStatus = 'matched' | 'not_in_research_library';
export type CatalogAmountDisclosureStatus = 'disclosed' | 'not_disclosed';
export type CatalogEntryMethod = 'manual' | 'nih_dsld_template' | 'open_food_facts_template' | 'ocr_template';
export type CatalogBarcodeFormat = 'upc_a' | 'upc_e' | 'ean_8' | 'ean_13' | 'gtin_14';
export type CatalogImageRole = 'front_label' | 'supplement_facts' | 'barcode';
export type CatalogImageAction = 'append' | 'replace_current';
export type CatalogUploadMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/heif';
export type CatalogFollowUpReason =
  | 'legacy_pre_web_contract_review'
  | 'legacy_single_leaf_blend'
  | 'legacy_missing_source_images'
  | 'legacy_nutrition_component_candidate'
  | 'legacy_formula_review'
  | 'legacy_barcode_review'
  | 'admin_marked_follow_up';
export type CatalogNutritionFactKey =
  | 'calories'
  | 'total_fat'
  | 'saturated_fat'
  | 'trans_fat'
  | 'cholesterol'
  | 'sodium'
  | 'total_carbohydrate'
  | 'dietary_fiber'
  | 'total_sugars'
  | 'added_sugars'
  | 'protein'
  | 'custom';
export type CatalogAppDoseUnit =
  | 'mcg' | 'mg' | 'g' | 'IU' | 'mL' | 'capsules' | 'tablets' | 'softgels'
  | 'drops' | 'scoops' | 'servings';
export type CatalogTimingBlock =
  | 'daily' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'
  | 'with_meal' | 'before_bed' | 'pre_workout' | 'post_workout'
  | 'around_workout' | 'empty_stomach' | 'before_meal' | 'between_meals';

export interface CatalogServingSizeInput {
  labelText: string;
  amount: number;
  unit: string;
}

export type CatalogDoseGuidanceInput =
  | { state: 'none'; labelText: null; mappedAmount: null; mappedUnit: null }
  | { state: 'structured'; labelText: string; mappedAmount: number; mappedUnit: CatalogAppDoseUnit }
  | { state: 'unmappable'; labelText: string; mappedAmount: null; mappedUnit: null };

export type CatalogTimingGuidanceInput =
  | { state: 'none'; labelText: null; mappedTiming: null }
  | { state: 'structured'; labelText: string; mappedTiming: CatalogTimingBlock }
  | { state: 'unmappable'; labelText: string; mappedTiming: null };

export type CatalogIngredientInput =
  | {
      componentType: 'ingredient'; labelName: string; libraryStatus: 'matched';
      canonicalKey: string; amountDisclosureStatus: 'disclosed'; amountText: string;
    }
  | {
      componentType: 'ingredient'; labelName: string; libraryStatus: 'matched';
      canonicalKey: string; amountDisclosureStatus: 'not_disclosed'; amountText: null;
    }
  | {
      componentType: 'ingredient'; labelName: string; libraryStatus: 'not_in_research_library';
      canonicalKey: null; amountDisclosureStatus: 'disclosed'; amountText: string;
    }
  | {
      componentType: 'ingredient'; labelName: string; libraryStatus: 'not_in_research_library';
      canonicalKey: null; amountDisclosureStatus: 'not_disclosed'; amountText: null;
    };

export interface CatalogProprietaryBlendInput {
  componentType: 'proprietary_blend';
  labelName: string;
  amountDisclosureStatus: 'disclosed';
  amountText: string;
  children: CatalogIngredientInput[];
}

export type CatalogComponentInput = CatalogIngredientInput | CatalogProprietaryBlendInput;

export interface CatalogNutritionFactInput {
  factKey: CatalogNutritionFactKey;
  labelName: string;
  amountText: string;
  amountValue: number;
  amountUnit: string;
  dailyValuePercent: number | null;
}

export interface CatalogProductWriteV2 {
  productType?: CatalogProductType;
  labelName: string;
  brandName: string;
  physicalForm: string;
  variant: string | null;
  marketRegion: string;
  primaryCanonicalKey?: string | null;
  servingSize: CatalogServingSizeInput;
  labelDoseGuidance: CatalogDoseGuidanceInput;
  labelTimingGuidance: CatalogTimingGuidanceInput;
  components: CatalogComponentInput[];
  nutritionFacts?: CatalogNutritionFactInput[];
  adminNotes?: string | null;
  needsFollowUp?: boolean;
  followUpReasons?: CatalogFollowUpReason[];
}

export interface CatalogProductInput extends CatalogProductWriteV2 {
  productType: CatalogProductType;
  primaryCanonicalKey: string | null;
  nutritionFacts: CatalogNutritionFactInput[];
  adminNotes: string | null;
  needsFollowUp: boolean;
  followUpReasons: CatalogFollowUpReason[];
}

export interface CatalogPackageSizeInput {
  labelText: string;
  amount: number;
  unit: string;
}

export interface CatalogBarcodeInput {
  value: string;
  format: CatalogBarcodeFormat;
  packageSize: CatalogPackageSizeInput | null;
}

export interface NormalizedCatalogBarcode extends CatalogBarcodeInput {
  gtin14: string;
}

export type CatalogTemplateProvenanceInput =
  | { entryMethod: 'manual'; sourceRecordId: null; sourceRetrievedAt: null }
  | { entryMethod: 'nih_dsld_template' | 'open_food_facts_template'; sourceRecordId: string; sourceRetrievedAt: string }
  | { entryMethod: 'ocr_template'; sourceRecordId: null; sourceRetrievedAt: string };

export interface CatalogImageSetInput {
  role: CatalogImageRole;
  action: CatalogImageAction;
  barcodeId?: string | null;
  uploadHandles: string[];
}

export interface CreateCatalogProductRequest {
  product: CatalogProductWriteV2;
  barcode?: CatalogBarcodeInput | null;
  templateProvenance?: CatalogTemplateProvenanceInput;
  imageSets?: CatalogImageSetInput[];
}

export interface UpdateCatalogProductRequest {
  expectedRevision: number;
  product: CatalogProductInput;
  imageSets?: CatalogImageSetInput[];
}

export interface AttachCatalogBarcodeRequest {
  barcode: CatalogBarcodeInput;
  imageSets?: CatalogImageSetInput[];
}

export interface ReassignCatalogBarcodeRequest {
  destinationProductId: string;
  expectedSourceProductId: string;
  expectedRevision: number;
}

export type CatalogIngredientDto = CatalogIngredientInput & { id: string; sortOrder: number };
export type CatalogProprietaryBlendDto = Omit<CatalogProprietaryBlendInput, 'children'> & {
  id: string;
  sortOrder: number;
  children: CatalogIngredientDto[];
};
export type CatalogComponentDto = CatalogIngredientDto | CatalogProprietaryBlendDto;

export interface CatalogBarcodeDto {
  id: string;
  productId: string;
  gtin14: string;
  labelBarcode: string;
  format: CatalogBarcodeFormat;
  packageSize: CatalogPackageSizeInput | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogNutritionFactDto extends CatalogNutritionFactInput {
  id: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogProductImageDto {
  id: string;
  barcodeId: string | null;
  evidenceSetId: string;
  role: CatalogImageRole;
  sortOrder: number;
  originalFilename: string;
  mimeType: CatalogUploadMimeType;
  byteSize: number;
  sha256: string;
  widthPx: number | null;
  heightPx: number | null;
  isCurrent: boolean;
  supersededAt: string | null;
  createdByEmail: string;
  createdAt: string;
}

export interface CatalogProductDetailDto {
  id: string;
  productType: CatalogProductType;
  status: CatalogProductStatus;
  labelName: string;
  brandName: string;
  physicalForm: string;
  variant: string | null;
  marketRegion: string;
  primaryCanonicalKey: string | null;
  servingSize: CatalogServingSizeInput;
  labelDoseGuidance: CatalogDoseGuidanceInput;
  labelTimingGuidance: CatalogTimingGuidanceInput;
  components: CatalogComponentDto[];
  templateProvenance: CatalogTemplateProvenanceInput;
  barcodes: CatalogBarcodeDto[];
  revision: number;
  createdByEmail: string;
  updatedByEmail: string;
  createdAt: string;
  updatedAt: string;
  publishedByEmail: string | null;
  publishedAt: string | null;
  retiredByEmail: string | null;
  retiredAt: string | null;
  activeLeafCount: number;
  nutritionFacts: CatalogNutritionFactDto[];
  images: CatalogProductImageDto[];
  adminNotes: string | null;
  needsFollowUp: boolean;
  followUpReasons: CatalogFollowUpReason[];
}

export interface CatalogProductBrowserSummaryDto {
  id: string;
  productType: CatalogProductType;
  status: CatalogProductStatus;
  labelName: string;
  brandName: string;
  physicalForm: string;
  variant: string | null;
  marketRegion: string;
  primaryCanonicalKey: string | null;
  servingSize: CatalogServingSizeInput;
  revision: number;
  updatedAt: string;
  activeLeafCount: number;
  barcodeCount: number;
  imageCount: number;
  nutritionFactCount: number;
  needsFollowUp: boolean;
  followUpReasons: CatalogFollowUpReason[];
}

export type CatalogBarcodeLookupResponse =
  | { found: false; normalizedBarcode: NormalizedCatalogBarcode }
  | {
      found: true;
      normalizedBarcode: NormalizedCatalogBarcode;
      barcode: CatalogBarcodeDto;
      product: CatalogProductDetailDto;
    };

export interface CatalogProductSearchResponse<T = CatalogProductDetailDto | CatalogProductBrowserSummaryDto> {
  results: T[];
  nextCursor: string | null;
}

export interface CatalogCanonicalSupplementSearchResponse {
  results: Array<{ canonicalKey: string; canonicalName: string; category: string | null }>;
}

export interface CatalogTemplateCanonicalCandidate {
  canonicalKey: string;
  canonicalName: string;
  matchReason: string;
}

export type CatalogTemplateLibraryResolution =
  | { status: 'confident'; canonicalKey: string; canonicalName: string; matchReason: string; candidates: CatalogTemplateCanonicalCandidate[] }
  | { status: 'ambiguous'; canonicalKey: null; canonicalName: null; matchReason: string; candidates: CatalogTemplateCanonicalCandidate[] }
  | { status: 'unresolved'; canonicalKey: null; canonicalName: null; matchReason: 'no_match'; candidates: [] };

export interface CatalogTemplateIngredient {
  componentType: 'ingredient';
  labelName: string;
  amountDisclosureStatus: CatalogAmountDisclosureStatus;
  amountText: string | null;
  libraryResolution: CatalogTemplateLibraryResolution;
  needsReview: boolean;
  reviewReasons: string[];
}

export interface CatalogTemplateProprietaryBlend {
  componentType: 'proprietary_blend';
  labelName: string;
  amountDisclosureStatus: 'disclosed';
  amountText: string;
  children: CatalogTemplateIngredient[];
  needsReview: boolean;
  reviewReasons: string[];
}

export type CatalogTemplateComponent = CatalogTemplateIngredient | CatalogTemplateProprietaryBlend;
export interface CatalogNutritionFactTemplate extends CatalogNutritionFactInput {
  needsReview: boolean;
  reviewReasons: string[];
}

export interface CatalogFormulaTemplateCandidate {
  templateId: string;
  source: 'nih_dsld_template' | 'open_food_facts_template' | 'ocr_template';
  sourceLabel: 'NIH DSLD' | 'Open Food Facts' | 'OCR';
  sourceRecordId: string | null;
  sourceRetrievedAt: string;
  sourceProductName: string | null;
  sourceBrandName: string | null;
  servingSize: CatalogServingSizeInput | null;
  servingSizeLabelText: string | null;
  components: CatalogTemplateComponent[];
  nutritionFacts: CatalogNutritionFactTemplate[];
  derivedProductType: CatalogProductType | null;
  hierarchyStatus: 'ready' | 'needs_review';
  reviewReasons: string[];
}

export interface CatalogPublicTemplateResponse {
  candidates: CatalogFormulaTemplateCandidate[];
  sourceErrors: Array<{ source: 'nih_dsld_template' | 'open_food_facts_template'; message: string }>;
}

export interface CatalogFrontLabelTemplateResponse {
  labelNameCandidates: string[];
  brandNameCandidates: string[];
  physicalFormCandidate: string | null;
  variantCandidate: string | null;
  reviewReasons: string[];
}

export type CatalogBarcodeDecodeResponse =
  | { status: 'decoded'; candidate: NormalizedCatalogBarcode; requiresConfirmation: true; warnings: string[] }
  | { status: 'manual_required'; candidate: null; reason: 'not_found' | 'multiple_candidates' | 'all_zero' | 'invalid_check_digit' };

export interface CatalogUploadRequest {
  files: Array<{
    clientId: string;
    role: CatalogImageRole;
    originalFilename: string;
    mimeType: CatalogUploadMimeType;
    byteSize: number;
    sha256: string;
  }>;
}

export interface CatalogUploadResponse {
  uploads: Array<{
    clientId: string;
    uploadHandle: string;
    uploadUrl: string;
    method: 'PUT';
    requiredHeaders: Record<string, string>;
    expiresAt: string;
  }>;
}

export interface CatalogTemplateDiffResponse {
  productId: string;
  comparedRevision: number;
  servingSize: { before: CatalogServingSizeInput; after: CatalogServingSizeInput | null; changed: boolean };
  componentChanges: Array<{
    kind: 'added' | 'removed' | 'changed' | 'moved';
    path: string;
    before: CatalogTemplateComponent | null;
    after: CatalogTemplateComponent | null;
  }>;
  nutritionFactChanges: Array<{
    kind: 'added' | 'removed' | 'changed';
    factKey: string;
    before: CatalogNutritionFactInput | null;
    after: CatalogNutritionFactInput | null;
  }>;
  reviewReasons: string[];
}

export interface CatalogApiErrorResponse {
  error: {
    code: string;
    message: string;
    field?: string;
    details?: Record<string, string | number | boolean | null>;
  };
}
