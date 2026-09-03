import assert from "node:assert/strict";
import { barcodeValidation, barcodeBlockers, emptyBarcode, emptySources, sourcesResolved, identityKey, identifyingFactors, allFactorsConfirmed } from "../app/admin/catalog/catalog-intake.ts";
import { evidenceImageSets } from "../app/admin/catalog/catalog-evidence.ts";

for (const [format, digits] of [["upc_a", "012345678905"], ["upc_e", "01234505"], ["ean_8", "96385074"], ["ean_13", "4006381333931"], ["gtin_14", "00012345678905"]]) {
  assert.equal(barcodeValidation(digits, format), null);
  assert.notEqual(barcodeValidation(digits.slice(0, -1) + (Number(digits.at(-1)) + 1) % 10, format), null);
  assert.notEqual(barcodeValidation("0".repeat(digits.length), format), null);
  assert.notEqual(barcodeValidation(digits.slice(1), format), null);
}
assert.equal(barcodeValidation("012-345 678905", "upc_a"), null);
assert.notEqual(barcodeValidation("01234567890x5", "upc_a"), null);
assert.equal(sourcesResolved(emptySources()), false);
const ready = { barcode: "skipped", front_label: "ready", supplement_facts: "skipped" };
assert.equal(sourcesResolved(ready), true);
for (const state of ["undecided", "processing", "analysis_failed"]) assert.equal(sourcesResolved({ ...ready, front_label: state }), false);
assert.equal(sourcesResolved({ barcode: "skipped", front_label: "skipped", supplement_facts: "skipped" }), true);
assert.equal(identityKey(" Product ", " Brand "), identityKey("product", "brand"));
assert.notEqual(identityKey("Product v2", "brand"), identityKey("product", "brand"));
for (const [label, brand] of [["Produc", "Brand"], ["Product extra", "Brand"], ["Product", "Brand extra"], ["Product", "Bränd"], ["Pro-duct", "Brand"], ["Pro  duct", "Brand"]]) {
  assert.notEqual(identityKey(label, brand), identityKey("Product", "Brand"), "identity matching must not normalize spelling, accents, punctuation, or internal whitespace");
}
assert.equal(allFactorsConfirmed(identifyingFactors.map(() => true)), true);
assert.equal(allFactorsConfirmed([]), false);
assert.equal(allFactorsConfirmed(identifyingFactors.map((_, i) => i !== 2)), false);
assert.deepEqual(barcodeBlockers(emptyBarcode(), null), []);
assert.equal(barcodeBlockers({ ...emptyBarcode(), value: "012345678905" }, null).length, 2);
const evidence = ["barcode", "front_label", "supplement_facts"].map((role) => ({ role, status: "uploaded", uploadHandle: `private-${role}` }));
assert.deepEqual(evidenceImageSets(evidence.filter((file) => file.role === "barcode"), "append"), [{ role: "barcode", action: "append", uploadHandles: ["private-barcode"] }]);
console.log("Catalog intake validation, gate, match confirmation, and barcode-only attachment tests passed.");
