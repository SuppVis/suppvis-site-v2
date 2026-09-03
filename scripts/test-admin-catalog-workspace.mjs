import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applySelectedReplacement,
  applyTemplateToDraft,
  catalogDraftBlockers,
  catalogProductFromDraft,
  createEmptyCatalogDraft,
  newIngredientDraft,
} from "../app/admin/catalog/catalog-draft.ts";
import {
  addEvidenceFiles,
  catalogRoleLimits,
  evidenceBlockers,
  evidenceImageSets,
  moveEvidenceFile,
  serializableEvidence,
} from "../app/admin/catalog/catalog-evidence.ts";

const valid = createEmptyCatalogDraft();
valid.labelName = "Zinc 30 mg";
valid.brandName = "Example";
valid.servingSizeLabelText = "Serving Size 1 Capsule";
valid.components = [{
  ...newIngredientDraft("Zinc"),
  resolution: "matched",
  canonicalKey: "zinc",
  canonicalName: "Zinc",
  amountDisclosureStatus: "disclosed",
  amountText: "30 mg",
}];
assert.deepEqual(catalogDraftBlockers(valid), []);
assert.equal(catalogProductFromDraft(valid).productType, "supplement");
assert.equal(catalogProductFromDraft(valid).primaryCanonicalKey, "zinc");

const duplicateTopLevel = structuredClone(valid);
duplicateTopLevel.components.push({ ...duplicateTopLevel.components[0], id: "duplicate-zinc" });
assert.match(catalogDraftBlockers(duplicateTopLevel).join(" "), /duplicates another top-level ingredient/);

const unresolved = structuredClone(valid);
unresolved.components[0].resolution = "ambiguous";
unresolved.components[0].canonicalKey = null;
assert.match(catalogDraftBlockers(unresolved).join(" "), /research-library decision/);
unresolved.components[0].resolution = "not_in_research_library";
assert.deepEqual(catalogDraftBlockers(unresolved), []);
assert.equal(catalogProductFromDraft(unresolved).primaryCanonicalKey, null);

const grouped = structuredClone(valid);
grouped.components = [{
  id: "group",
  componentType: "proprietary_blend",
  labelName: "Mineral blend",
  amountText: "60 mg",
  reviewReasons: [],
  children: [valid.components[0], { ...valid.components[0], id: "second", labelName: "Copper", canonicalKey: "copper" }],
}];
assert.equal(catalogProductFromDraft(grouped).productType, "blend");
assert.equal(catalogProductFromDraft(grouped).primaryCanonicalKey, null);
grouped.hierarchyReviewRequired = true;
assert.match(catalogDraftBlockers(grouped).join(" "), /hierarchy review/);

const candidate = {
  templateId: "ocr:1",
  source: "ocr_template",
  sourceLabel: "OCR",
  sourceRecordId: null,
  sourceRetrievedAt: "2026-09-02T12:00:00.000Z",
  sourceProductName: "Source label",
  sourceBrandName: "Source brand",
  servingSize: { labelText: "Serving Size 2 Capsules", amount: 2, unit: "capsule" },
  servingSizeLabelText: "Serving Size 2 Capsules",
  components: [{
    componentType: "ingredient",
    labelName: "Zinc",
    amountDisclosureStatus: "disclosed",
    amountText: "25 mg",
    libraryResolution: { status: "confident", canonicalKey: "zinc", canonicalName: "Zinc", matchReason: "exact", candidates: [] },
    needsReview: false,
    reviewReasons: [],
  }],
  nutritionFacts: [],
  derivedProductType: "supplement",
  hierarchyStatus: "ready",
  reviewReasons: [],
};
const applied = applyTemplateToDraft(valid, candidate);
assert.equal(valid.labelName, "Zinc 30 mg", "Source candidates must not mutate the existing draft.");
assert.equal(applied.labelName, "Source label");
assert.equal(applied.components[0].resolution, "matched");
assert.equal(applied.templateProvenance.entryMethod, "ocr_template");
assert.match(applied.sourceReviewReasons.join(" "), /Review all source values and preselected research-library matches/);

const publicCandidate = {
  ...candidate,
  templateId: "nih:2",
  source: "nih_dsld_template",
  sourceLabel: "NIH DSLD",
  sourceRecordId: "DSLD-2",
};
const switchedNewDraft = applyTemplateToDraft(applied, publicCandidate);
assert.equal(switchedNewDraft.templateProvenance.entryMethod, "nih_dsld_template",
  "a new draft must record the source candidate the administrator actually accepted");
assert.equal(switchedNewDraft.templateProvenance.sourceRecordId, "DSLD-2");
const existingWithOriginalProvenance = {
  ...valid,
  templateProvenance: {
    entryMethod: "open_food_facts_template",
    sourceRecordId: "OFF-1",
    sourceRetrievedAt: "2026-09-01T12:00:00.000Z",
  },
};
const replacedExisting = applyTemplateToDraft(existingWithOriginalProvenance, publicCandidate, true);
assert.deepEqual(replacedExisting.templateProvenance, existingWithOriginalProvenance.templateProvenance,
  "replacement templates must not rewrite the product's original creation provenance");

const noSelection = { labelName: false, brandName: false, servingSize: false, formula: false, nutritionKeys: [] };
assert.deepEqual(applySelectedReplacement(valid, candidate, noSelection), valid,
  "unchecked replacement values must leave every current field unchanged");
const servingOnly = applySelectedReplacement(valid, candidate, { ...noSelection, servingSize: true });
assert.equal(servingOnly.servingSizeAmount, "2");
assert.deepEqual(servingOnly.components, valid.components);
assert.equal(servingOnly.labelName, valid.labelName);
const formulaOnly = applySelectedReplacement(valid, candidate, { ...noSelection, formula: true });
assert.equal(formulaOnly.components[0].amountText, "25 mg");
assert.equal(formulaOnly.servingSizeAmount, valid.servingSizeAmount);
assert.deepEqual(formulaOnly.templateProvenance, valid.templateProvenance);
const sodium = { id: "sodium", factKey: "sodium", labelName: "Sodium", amountText: "15 mg", amountValue: "15", amountUnit: "mg", dailyValuePercent: "1", reviewReasons: [] };
const nutritionCurrent = { ...valid, nutritionFacts: [sodium] };
const nutritionCandidate = { ...candidate, nutritionFacts: [{ ...sodium, amountText: "30 mg", amountValue: 30, dailyValuePercent: 2 }] };
const nutritionOnly = applySelectedReplacement(nutritionCurrent, nutritionCandidate, { ...noSelection, nutritionKeys: ["sodium"] });
assert.equal(nutritionOnly.nutritionFacts[0].amountText, "30 mg");
assert.deepEqual(nutritionOnly.components, valid.components);
assert.equal(applySelectedReplacement(nutritionCurrent, candidate, noSelection).nutritionFacts.length, 1);
assert.equal(applySelectedReplacement(nutritionCurrent, candidate, { ...noSelection, nutritionKeys: ["sodium"] }).nutritionFacts.length, 0,
  "removal requires an explicit nutrition choice");

const invalidGuidance = structuredClone(valid);
invalidGuidance.doseGuidanceState = "structured";
invalidGuidance.doseGuidanceText = "Take one daily";
invalidGuidance.doseGuidanceAmount = "1";
invalidGuidance.doseGuidanceUnit = "bottles";
invalidGuidance.timingGuidanceState = "structured";
invalidGuidance.timingGuidanceText = "At breakfast";
invalidGuidance.timingGuidanceBlock = "breakfast";
assert.match(catalogDraftBlockers(invalidGuidance).join(" "), /supported app dose unit/);
assert.match(catalogDraftBlockers(invalidGuidance).join(" "), /supported app timing block/);

const duplicateNutrition = structuredClone(valid);
duplicateNutrition.nutritionFacts = [
  { id: "sodium-1", factKey: "sodium", labelName: "Sodium", amountText: "0 mg", amountValue: "0", amountUnit: "mg", dailyValuePercent: "0", reviewReasons: [] },
  { id: "sodium-2", factKey: "sodium", labelName: "Salt", amountText: "0 mg", amountValue: "0", amountUnit: "mg", dailyValuePercent: "0", reviewReasons: [] },
  { id: "custom-1", factKey: "custom", labelName: "Sugar alcohol", amountText: "1 g", amountValue: "1", amountUnit: "g", dailyValuePercent: "", reviewReasons: [] },
  { id: "custom-2", factKey: "custom", labelName: " sugar   ALCOHOL ", amountText: "1 g", amountValue: "1", amountUnit: "g", dailyValuePercent: "", reviewReasons: [] },
];
const nutritionBlockers = catalogDraftBlockers(duplicateNutrition).join(" ");
assert.match(nutritionBlockers, /Standard nutrition fact sodium is duplicated/);
assert.match(nutritionBlockers, /Custom nutrition fact sugar\s+ALCOHOL is duplicated/i);

const evidence = [
  { clientId: "front-a", role: "front_label", fileName: "a.jpg", mimeType: "image/jpeg", byteSize: 10, sha256: "a", uploadHandle: "front-handle", expiresAt: "later", status: "uploaded", error: null },
  { clientId: "facts-a", role: "supplement_facts", fileName: "1.jpg", mimeType: "image/jpeg", byteSize: 10, sha256: "b", uploadHandle: "facts-1", expiresAt: "later", status: "uploaded", error: null },
  { clientId: "facts-b", role: "supplement_facts", fileName: "2.jpg", mimeType: "image/jpeg", byteSize: 10, sha256: "c", uploadHandle: "facts-2", expiresAt: "later", status: "uploaded", error: null },
  { clientId: "barcode-a", role: "barcode", fileName: "b.jpg", mimeType: "image/jpeg", byteSize: 10, sha256: "d", uploadHandle: "barcode-handle", expiresAt: "later", status: "uploaded", error: null },
];
assert.deepEqual(evidenceBlockers(evidence), []);
assert.deepEqual(evidenceBlockers([]), [], "new drafts may be saved without evidence images");
assert.deepEqual(catalogRoleLimits, { front_label: 1, supplement_facts: 4, barcode: 1 });
const replacementFront = addEvidenceFiles(evidence, "front_label", [{
  name: "replacement.jpg", type: "image/jpeg", size: 20,
}]);
assert.deepEqual(replacementFront.filter((file) => file.role === "front_label").map((file) => file.fileName), ["replacement.jpg"],
  "selecting a new front-label image must replace the pending front-label selection");
assert.throws(() => addEvidenceFiles(evidence, "barcode", [
  { name: "barcode-1.jpg", type: "image/jpeg", size: 20 },
  { name: "barcode-2.jpg", type: "image/jpeg", size: 20 },
]), /accepts one image/, "front-label and barcode roles reject multi-image selection");
assert.deepEqual(evidenceImageSets(evidence, "append").map((set) => [set.role, set.uploadHandles]), [
  ["front_label", ["front-handle"]],
  ["supplement_facts", ["facts-1", "facts-2"]],
  ["barcode", ["barcode-handle"]],
]);
const reordered = moveEvidenceFile(evidence, "facts-b", -1);
assert.deepEqual(reordered.filter((file) => file.role === "supplement_facts").map((file) => file.clientId), ["facts-b", "facts-a"]);
const partial = [...evidence, { ...evidence[0], clientId: "failed", status: "failed", uploadHandle: null }];
assert.match(evidenceBlockers(partial).join(" "), /Upload or remove/);
assert.equal(serializableEvidence(partial).some((file) => file.clientId === "failed"), true);
assert.match(serializableEvidence(partial).at(-1).error, /reselected after reload/);
assert.equal(serializableEvidence([{ ...evidence[0], file: { secretLocalBytes: true } }])[0].file, undefined);
assert.equal(serializableEvidence([{ ...evidence[0], status: "uploading" }])[0].status, "failed",
  "an interrupted upload must not remain permanently busy after reload");
const expired = [{ ...evidence[0], expiresAt: "2000-01-01T00:00:00.000Z" }];
assert.match(evidenceBlockers(expired).join(" "), /expired pending evidence/);

const workspaceSource = readFileSync("app/admin/catalog/CatalogWorkspace.tsx", "utf8");
const saveStart = workspaceSource.indexOf("async function saveDraft()");
const saveEnd = workspaceSource.indexOf("async function viewImage", saveStart);
assert.ok(saveStart > 0 && saveEnd > saveStart);
const saveSource = workspaceSource.slice(saveStart, saveEnd);
for (const mutation of ["createCatalogProduct", "updateCatalogProduct", "attachCatalogBarcode", "reassignCatalogBarcode"]) {
  assert.match(saveSource, new RegExp(`await ${mutation}\\(`), `${mutation} must be confined to Save draft.`);
  const outsideSave = `${workspaceSource.slice(0, saveStart)}${workspaceSource.slice(saveEnd)}`;
  assert.doesNotMatch(outsideSave, new RegExp(`await ${mutation}\\(`), `${mutation} escaped Save draft.`);
}
assert.match(workspaceSource, /caught\.code === "REVISION_CONFLICT"/);
assert.match(workspaceSource, /loadProduct\(selected\.id, false\)/);
assert.match(workspaceSource, /Use source label:/);
assert.match(workspaceSource, /localStorage\.setItem/);
assert.match(workspaceSource, /suppressNextPersistence/);
assert.match(workspaceSource, /canonicalKey/);
assert.match(workspaceSource, /brandName/);
assert.match(workspaceSource, /barcode operation still needs to be retried after a fresh lookup/);

console.log("Website admin catalog workspace state checks passed.");
