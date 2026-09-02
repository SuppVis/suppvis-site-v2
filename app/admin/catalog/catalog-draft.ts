import type {
  CatalogAmountDisclosureStatus,
  CatalogAppDoseUnit,
  CatalogComponentInput,
  CatalogFollowUpReason,
  CatalogFormulaTemplateCandidate,
  CatalogIngredientInput,
  CatalogNutritionFactInput,
  CatalogNutritionFactKey,
  CatalogProductDetailDto,
  CatalogProductInput,
  CatalogTemplateCanonicalCandidate,
  CatalogTemplateIngredient,
  CatalogTemplateProvenanceInput,
  CatalogTimingBlock,
} from "./contracts.generated";

export type IngredientResolution =
  | "matched"
  | "not_in_research_library"
  | "ambiguous"
  | "unresolved";

export type CatalogIngredientDraft = {
  id: string;
  componentType: "ingredient";
  labelName: string;
  resolution: IngredientResolution;
  canonicalKey: string | null;
  canonicalName: string | null;
  candidates: CatalogTemplateCanonicalCandidate[];
  amountDisclosureStatus: CatalogAmountDisclosureStatus;
  amountText: string;
  reviewReasons: string[];
};

export type CatalogGroupDraft = {
  id: string;
  componentType: "proprietary_blend";
  labelName: string;
  amountText: string;
  children: CatalogIngredientDraft[];
  reviewReasons: string[];
};

export type CatalogComponentDraft = CatalogIngredientDraft | CatalogGroupDraft;

export type CatalogNutritionDraft = {
  id: string;
  factKey: CatalogNutritionFactKey;
  labelName: string;
  amountText: string;
  amountValue: string;
  amountUnit: string;
  dailyValuePercent: string;
  reviewReasons: string[];
};

export type CatalogEditorDraft = {
  draftVersion: 1;
  labelName: string;
  brandName: string;
  physicalForm: string;
  variant: string;
  marketRegion: string;
  servingSizeLabelText: string;
  servingSizeAmount: string;
  servingSizeUnit: string;
  doseGuidanceState: "none" | "structured" | "unmappable";
  doseGuidanceText: string;
  doseGuidanceAmount: string;
  doseGuidanceUnit: CatalogAppDoseUnit;
  timingGuidanceState: "none" | "structured" | "unmappable";
  timingGuidanceText: string;
  timingGuidanceBlock: CatalogTimingBlock;
  components: CatalogComponentDraft[];
  nutritionFacts: CatalogNutritionDraft[];
  adminNotes: string;
  needsFollowUp: boolean;
  followUpReasons: CatalogFollowUpReason[];
  templateProvenance: CatalogTemplateProvenanceInput;
  hierarchyReviewRequired: boolean;
  hierarchyReviewAcknowledged: boolean;
  sourceReviewReasons: string[];
};

export const CATALOG_APP_DOSE_UNITS: readonly CatalogAppDoseUnit[] = [
  "mcg", "mg", "g", "IU", "mL", "capsules", "tablets", "softgels",
  "drops", "scoops", "servings",
];

export const CATALOG_TIMING_BLOCKS: readonly CatalogTimingBlock[] = [
  "daily", "morning", "midday", "afternoon", "evening", "night",
  "with_meal", "before_bed", "pre_workout", "post_workout",
  "around_workout", "empty_stomach", "before_meal", "between_meals",
];

let fallbackId = 0;
export function localDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  fallbackId += 1;
  return `draft-${fallbackId}`;
}

export function newIngredientDraft(labelName = ""): CatalogIngredientDraft {
  return {
    id: localDraftId(),
    componentType: "ingredient",
    labelName,
    resolution: "unresolved",
    canonicalKey: null,
    canonicalName: null,
    candidates: [],
    amountDisclosureStatus: "not_disclosed",
    amountText: "",
    reviewReasons: [],
  };
}

export function createEmptyCatalogDraft(): CatalogEditorDraft {
  return {
    draftVersion: 1,
    labelName: "",
    brandName: "",
    physicalForm: "capsule",
    variant: "",
    marketRegion: "US",
    servingSizeLabelText: "",
    servingSizeAmount: "1",
    servingSizeUnit: "capsule",
    doseGuidanceState: "none",
    doseGuidanceText: "",
    doseGuidanceAmount: "",
    doseGuidanceUnit: "capsules",
    timingGuidanceState: "none",
    timingGuidanceText: "",
    timingGuidanceBlock: "daily",
    components: [newIngredientDraft()],
    nutritionFacts: [],
    adminNotes: "",
    needsFollowUp: false,
    followUpReasons: [],
    templateProvenance: {
      entryMethod: "manual",
      sourceRecordId: null,
      sourceRetrievedAt: null,
    },
    hierarchyReviewRequired: false,
    hierarchyReviewAcknowledged: false,
    sourceReviewReasons: [],
  };
}

function ingredientFromInput(input: CatalogIngredientInput): CatalogIngredientDraft {
  return {
    id: localDraftId(),
    componentType: "ingredient",
    labelName: input.labelName,
    resolution: input.libraryStatus,
    canonicalKey: input.canonicalKey,
    canonicalName: input.libraryStatus === "matched" ? input.labelName : null,
    candidates: [],
    amountDisclosureStatus: input.amountDisclosureStatus,
    amountText: input.amountText ?? "",
    reviewReasons: [],
  };
}

export function draftFromProduct(product: CatalogProductDetailDto): CatalogEditorDraft {
  return {
    draftVersion: 1,
    labelName: product.labelName,
    brandName: product.brandName,
    physicalForm: product.physicalForm,
    variant: product.variant ?? "",
    marketRegion: product.marketRegion,
    servingSizeLabelText: product.servingSize.labelText,
    servingSizeAmount: String(product.servingSize.amount),
    servingSizeUnit: product.servingSize.unit,
    doseGuidanceState: product.labelDoseGuidance.state,
    doseGuidanceText: product.labelDoseGuidance.labelText ?? "",
    doseGuidanceAmount: product.labelDoseGuidance.state === "structured"
      ? String(product.labelDoseGuidance.mappedAmount)
      : "",
    doseGuidanceUnit: product.labelDoseGuidance.state === "structured"
      ? product.labelDoseGuidance.mappedUnit
      : "capsules",
    timingGuidanceState: product.labelTimingGuidance.state,
    timingGuidanceText: product.labelTimingGuidance.labelText ?? "",
    timingGuidanceBlock: product.labelTimingGuidance.state === "structured"
      ? product.labelTimingGuidance.mappedTiming
      : "daily",
    components: product.components.map((component): CatalogComponentDraft => (
      component.componentType === "ingredient"
        ? ingredientFromInput(component)
        : {
            id: localDraftId(),
            componentType: "proprietary_blend",
            labelName: component.labelName,
            amountText: component.amountText,
            children: component.children.map(ingredientFromInput),
            reviewReasons: [],
          }
    )),
    nutritionFacts: product.nutritionFacts.map((fact) => ({
      id: localDraftId(),
      factKey: fact.factKey,
      labelName: fact.labelName,
      amountText: fact.amountText,
      amountValue: String(fact.amountValue),
      amountUnit: fact.amountUnit,
      dailyValuePercent: fact.dailyValuePercent === null ? "" : String(fact.dailyValuePercent),
      reviewReasons: [],
    })),
    adminNotes: product.adminNotes ?? "",
    needsFollowUp: product.needsFollowUp,
    followUpReasons: [...product.followUpReasons],
    templateProvenance: product.templateProvenance,
    hierarchyReviewRequired: false,
    hierarchyReviewAcknowledged: false,
    sourceReviewReasons: [],
  };
}

function ingredientFromTemplate(input: CatalogTemplateIngredient): CatalogIngredientDraft {
  return {
    id: localDraftId(),
    componentType: "ingredient",
    labelName: input.labelName,
    resolution: input.libraryResolution.status === "confident"
      ? "matched"
      : input.libraryResolution.status,
    canonicalKey: input.libraryResolution.status === "confident"
      ? input.libraryResolution.canonicalKey
      : null,
    canonicalName: input.libraryResolution.status === "confident"
      ? input.libraryResolution.canonicalName
      : null,
    candidates: [...input.libraryResolution.candidates],
    amountDisclosureStatus: input.amountDisclosureStatus,
    amountText: input.amountText ?? "",
    reviewReasons: [...input.reviewReasons],
  };
}

export function applyTemplateToDraft(
  current: CatalogEditorDraft,
  candidate: CatalogFormulaTemplateCandidate,
  preserveTemplateProvenance = false,
): CatalogEditorDraft {
  return {
    ...current,
    labelName: candidate.sourceProductName ?? current.labelName,
    brandName: candidate.sourceBrandName ?? current.brandName,
    servingSizeLabelText: candidate.servingSize?.labelText ?? current.servingSizeLabelText,
    servingSizeAmount: candidate.servingSize ? String(candidate.servingSize.amount) : current.servingSizeAmount,
    servingSizeUnit: candidate.servingSize?.unit ?? current.servingSizeUnit,
    components: candidate.components.map((component): CatalogComponentDraft => (
      component.componentType === "ingredient"
        ? ingredientFromTemplate(component)
        : {
            id: localDraftId(),
            componentType: "proprietary_blend",
            labelName: component.labelName,
            amountText: component.amountText,
            children: component.children.map(ingredientFromTemplate),
            reviewReasons: [...component.reviewReasons],
          }
    )),
    nutritionFacts: candidate.nutritionFacts.map((fact) => ({
      id: localDraftId(),
      factKey: fact.factKey,
      labelName: fact.labelName,
      amountText: fact.amountText,
      amountValue: String(fact.amountValue),
      amountUnit: fact.amountUnit,
      dailyValuePercent: fact.dailyValuePercent === null ? "" : String(fact.dailyValuePercent),
      reviewReasons: [...fact.reviewReasons],
    })),
    templateProvenance: preserveTemplateProvenance
      ? current.templateProvenance
      : candidate.source === "ocr_template"
        ? {
            entryMethod: "ocr_template",
            sourceRecordId: null,
            sourceRetrievedAt: candidate.sourceRetrievedAt,
          }
        : {
            entryMethod: candidate.source,
            sourceRecordId: candidate.sourceRecordId!,
            sourceRetrievedAt: candidate.sourceRetrievedAt,
          },
    hierarchyReviewRequired: candidate.hierarchyStatus === "needs_review",
    hierarchyReviewAcknowledged: candidate.hierarchyStatus === "ready",
    sourceReviewReasons: [...candidate.reviewReasons],
  };
}

function activeLeaves(draft: CatalogEditorDraft) {
  return draft.components.flatMap((component) => (
    component.componentType === "ingredient" ? [component] : component.children
  ));
}

function ingredientIdentity(ingredient: CatalogIngredientDraft) {
  return ingredient.resolution === "matched" && ingredient.canonicalKey
    ? `key:${ingredient.canonicalKey.toLowerCase()}`
    : `label:${ingredient.labelName.toLowerCase()}`;
}

export function catalogDraftBlockers(draft: CatalogEditorDraft): string[] {
  const blockers: string[] = [];
  if (!draft.labelName.trim()) blockers.push("Product label name is required.");
  if (draft.labelName.trim().length > 200) blockers.push("Product label name must be 200 characters or fewer.");
  if (!draft.brandName.trim()) blockers.push("Brand name is required.");
  if (draft.brandName.trim().length > 160) blockers.push("Brand name must be 160 characters or fewer.");
  if (!draft.physicalForm.trim()) blockers.push("Physical form is required.");
  if (draft.physicalForm.trim().length > 80) blockers.push("Physical form must be 80 characters or fewer.");
  if (draft.variant.trim().length > 120) blockers.push("Variant must be 120 characters or fewer.");
  if (!/^[A-Z]{2}$/.test(draft.marketRegion.trim())) blockers.push("Market region must be a two-letter code.");
  const servingAmount = Number(draft.servingSizeAmount);
  if (!draft.servingSizeLabelText.trim() || !Number.isFinite(servingAmount) || servingAmount <= 0 || !draft.servingSizeUnit.trim()) {
    blockers.push("A complete positive serving-size basis is required.");
  }
  if (draft.servingSizeLabelText.trim().length > 160 || draft.servingSizeUnit.trim().length > 40) {
    blockers.push("Serving-size label text or unit exceeds the catalog limit.");
  }
  if (draft.components.length > 100) blockers.push("A formula may contain no more than 100 top-level rows.");
  const leaves = activeLeaves(draft);
  if (leaves.length === 0) blockers.push("At least one active ingredient is required.");
  if (leaves.length > 100) blockers.push("A formula may contain no more than 100 active ingredients.");
  for (const leaf of leaves) {
    if (!leaf.labelName.trim()) blockers.push("Every active ingredient needs its exact label name.");
    if (leaf.labelName.trim().length > 200) blockers.push(`${leaf.labelName.trim()} exceeds the ingredient-name limit.`);
    if (leaf.resolution === "ambiguous" || leaf.resolution === "unresolved") {
      blockers.push(`${leaf.labelName || "An ingredient"} still needs a research-library decision.`);
    }
    if (leaf.resolution === "matched" && !leaf.canonicalKey) {
      blockers.push(`${leaf.labelName || "An ingredient"} needs a canonical research identity.`);
    }
    if (leaf.amountDisclosureStatus === "disclosed" && !leaf.amountText.trim()) {
      blockers.push(`${leaf.labelName || "An ingredient"} needs its exact disclosed amount text.`);
    }
    if (leaf.amountText.trim().length > 160) blockers.push(`${leaf.labelName || "An ingredient"} exceeds the amount-text limit.`);
  }
  const topLevelIngredients = new Set<string>();
  const groupNames = new Set<string>();
  for (const component of draft.components) {
    if (component.componentType === "ingredient") {
      const identity = ingredientIdentity(component);
      if (topLevelIngredients.has(identity)) blockers.push(`${component.labelName || "An ingredient"} duplicates another top-level ingredient.`);
      topLevelIngredients.add(identity);
      continue;
    }
    const group = component;
    if (!group.labelName.trim() || !group.amountText.trim() || group.children.length === 0) {
      blockers.push("Every proprietary blend needs a name, disclosed total, and at least one child.");
    }
    if (group.labelName.trim().length > 200 || group.amountText.trim().length > 160) {
      blockers.push(`${group.labelName || "A proprietary blend"} exceeds a catalog text limit.`);
    }
    if (group.children.length > 100) blockers.push(`${group.labelName || "A proprietary blend"} has more than 100 children.`);
    const normalizedGroupName = group.labelName.toLowerCase();
    if (groupNames.has(normalizedGroupName)) blockers.push(`${group.labelName || "A proprietary blend"} duplicates another proprietary-blend name.`);
    groupNames.add(normalizedGroupName);
    const childIdentities = new Set<string>();
    for (const child of group.children) {
      const identity = ingredientIdentity(child);
      if (childIdentities.has(identity)) blockers.push(`${child.labelName || "An ingredient"} is duplicated inside ${group.labelName || "a proprietary blend"}.`);
      childIdentities.add(identity);
    }
  }
  if (draft.hierarchyReviewRequired && !draft.hierarchyReviewAcknowledged) {
    blockers.push("Acknowledge the source hierarchy review before saving.");
  }
  const standardNutritionKeys = new Set<CatalogNutritionFactKey>();
  const customNutritionLabels = new Set<string>();
  if (draft.nutritionFacts.length > 50) blockers.push("A product may contain no more than 50 nutrition rows.");
  for (const fact of draft.nutritionFacts) {
    if (!fact.labelName.trim() || !fact.amountText.trim() || !fact.amountUnit.trim()
        || !Number.isFinite(Number(fact.amountValue)) || Number(fact.amountValue) < 0
        || (fact.dailyValuePercent !== "" && (
          !Number.isFinite(Number(fact.dailyValuePercent)) || Number(fact.dailyValuePercent) < 0
        ))) blockers.push(`Nutrition row ${fact.labelName || fact.factKey} is incomplete or invalid.`);
    if (fact.labelName.trim().length > 160 || fact.amountText.trim().length > 160 || fact.amountUnit.trim().length > 40) {
      blockers.push(`Nutrition row ${fact.labelName || fact.factKey} exceeds a catalog text limit.`);
    }
    if (fact.factKey === "custom") {
      const normalizedLabel = fact.labelName.trim().replace(/\s+/g, " ").toLowerCase();
      if (normalizedLabel && customNutritionLabels.has(normalizedLabel)) {
        blockers.push(`Custom nutrition fact ${fact.labelName.trim()} is duplicated.`);
      }
      if (normalizedLabel) customNutritionLabels.add(normalizedLabel);
    } else {
      if (standardNutritionKeys.has(fact.factKey)) {
        blockers.push(`Standard nutrition fact ${fact.factKey.replaceAll("_", " ")} is duplicated.`);
      }
      standardNutritionKeys.add(fact.factKey);
    }
  }
  if (draft.needsFollowUp && draft.followUpReasons.length === 0 && !draft.adminNotes.trim()) {
    blockers.push("Follow-up requires a structured reason, admin notes, or both.");
  }
  if (!draft.needsFollowUp && draft.followUpReasons.length > 0) {
    blockers.push("Clear structured reasons or turn follow-up on.");
  }
  if (draft.adminNotes.trim().length > 4000) blockers.push("Admin notes must be 4,000 characters or fewer.");
  if (draft.doseGuidanceState !== "none" && !draft.doseGuidanceText.trim()) {
    blockers.push("Dose guidance needs exact label text.");
  }
  if (draft.doseGuidanceText.trim().length > 500) blockers.push("Dose guidance must be 500 characters or fewer.");
  const mappedDoseAmount = Number(draft.doseGuidanceAmount);
  if (draft.doseGuidanceState === "structured" && (!Number.isFinite(mappedDoseAmount) || mappedDoseAmount <= 0)) {
    blockers.push("Structured dose guidance needs a positive mapped amount.");
  }
  if (draft.doseGuidanceState === "structured" && !CATALOG_APP_DOSE_UNITS.includes(draft.doseGuidanceUnit)) {
    blockers.push("Structured dose guidance needs a supported app dose unit.");
  }
  if (draft.timingGuidanceState !== "none" && !draft.timingGuidanceText.trim()) {
    blockers.push("Timing guidance needs exact label text.");
  }
  if (draft.timingGuidanceText.trim().length > 500) blockers.push("Timing guidance must be 500 characters or fewer.");
  if (draft.timingGuidanceState === "structured" && !CATALOG_TIMING_BLOCKS.includes(draft.timingGuidanceBlock)) {
    blockers.push("Structured timing guidance needs a supported app timing block.");
  }
  return [...new Set(blockers)];
}

function finalIngredient(draft: CatalogIngredientDraft): CatalogIngredientInput {
  const base = {
    componentType: "ingredient" as const,
    labelName: draft.labelName.trim(),
  };
  if (draft.resolution === "matched") {
    return draft.amountDisclosureStatus === "disclosed"
      ? { ...base, libraryStatus: "matched", canonicalKey: draft.canonicalKey!, amountDisclosureStatus: "disclosed", amountText: draft.amountText.trim() }
      : { ...base, libraryStatus: "matched", canonicalKey: draft.canonicalKey!, amountDisclosureStatus: "not_disclosed", amountText: null };
  }
  return draft.amountDisclosureStatus === "disclosed"
    ? { ...base, libraryStatus: "not_in_research_library", canonicalKey: null, amountDisclosureStatus: "disclosed", amountText: draft.amountText.trim() }
    : { ...base, libraryStatus: "not_in_research_library", canonicalKey: null, amountDisclosureStatus: "not_disclosed", amountText: null };
}

export function catalogProductFromDraft(draft: CatalogEditorDraft): CatalogProductInput {
  const blockers = catalogDraftBlockers(draft);
  if (blockers.length > 0) throw new Error(blockers[0]);
  const leaves = activeLeaves(draft);
  const components: CatalogComponentInput[] = draft.components.map((component) => (
    component.componentType === "ingredient"
      ? finalIngredient(component)
      : {
          componentType: "proprietary_blend" as const,
          labelName: component.labelName.trim(),
          amountDisclosureStatus: "disclosed" as const,
          amountText: component.amountText.trim(),
          children: component.children.map(finalIngredient),
        }
  ));
  const nutritionFacts: CatalogNutritionFactInput[] = draft.nutritionFacts.map((fact) => ({
    factKey: fact.factKey,
    labelName: fact.labelName.trim(),
    amountText: fact.amountText.trim(),
    amountValue: Number(fact.amountValue),
    amountUnit: fact.amountUnit.trim(),
    dailyValuePercent: fact.dailyValuePercent === "" ? null : Number(fact.dailyValuePercent),
  }));
  const singleLeaf = leaves.length === 1 ? leaves[0] : null;
  return {
    productType: singleLeaf ? "supplement" : "blend",
    labelName: draft.labelName.trim(),
    brandName: draft.brandName.trim(),
    physicalForm: draft.physicalForm.trim(),
    variant: draft.variant.trim() || null,
    marketRegion: draft.marketRegion.trim().toUpperCase(),
    primaryCanonicalKey: singleLeaf?.resolution === "matched" ? singleLeaf.canonicalKey : null,
    servingSize: {
      labelText: draft.servingSizeLabelText.trim(),
      amount: Number(draft.servingSizeAmount),
      unit: draft.servingSizeUnit.trim(),
    },
    labelDoseGuidance: draft.doseGuidanceState === "none"
      ? { state: "none", labelText: null, mappedAmount: null, mappedUnit: null }
      : draft.doseGuidanceState === "structured"
        ? {
            state: "structured",
            labelText: draft.doseGuidanceText.trim(),
            mappedAmount: Number(draft.doseGuidanceAmount),
            mappedUnit: draft.doseGuidanceUnit,
          }
        : {
            state: "unmappable",
            labelText: draft.doseGuidanceText.trim(),
            mappedAmount: null,
            mappedUnit: null,
          },
    labelTimingGuidance: draft.timingGuidanceState === "none"
      ? { state: "none", labelText: null, mappedTiming: null }
      : draft.timingGuidanceState === "structured"
        ? {
            state: "structured",
            labelText: draft.timingGuidanceText.trim(),
            mappedTiming: draft.timingGuidanceBlock,
          }
        : {
            state: "unmappable",
            labelText: draft.timingGuidanceText.trim(),
            mappedTiming: null,
          },
    components,
    nutritionFacts,
    adminNotes: draft.adminNotes.trim() || null,
    needsFollowUp: draft.needsFollowUp,
    followUpReasons: draft.needsFollowUp ? [...draft.followUpReasons] : [],
  };
}
