import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { webcrypto, randomUUID } from "node:crypto";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:3000" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "localStorage", "MutationObserver"]) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
Object.defineProperty(globalThis, "crypto", { configurable: true, value: { subtle: webcrypto.subtle, randomUUID } });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.confirm = () => true;
URL.createObjectURL = () => "blob:http://localhost/test-image";
URL.revokeObjectURL = () => {};
const React = await import("react");
const { render, cleanup, fireEvent, screen, waitFor, act } = await import("@testing-library/react");
const { default: CatalogBarcodeFormatHelp } = await import("../app/admin/catalog/CatalogBarcodeFormatHelp.tsx");
// Format help escapes narrow upload columns and remains anchored on scroll/resize.
const originalRect = HTMLElement.prototype.getBoundingClientRect;
let anchorTop = 100;
HTMLElement.prototype.getBoundingClientRect = function () {
  return this.getAttribute("role") === "tooltip"
    ? { height: 180 }
    : { top: anchorTop, bottom: anchorTop + 16 };
};
const helpView = render(React.createElement("div", { style: { width: 200, overflow: "hidden" } },
  React.createElement(CatalogBarcodeFormatHelp, null, "UPC-A: 12 digits")));
const helpButton = screen.getByRole("button", { name: "About barcode formats" });
assert.equal(screen.queryByRole("tooltip"), null);
fireEvent.mouseEnter(helpButton.parentElement);
let help = screen.getByRole("tooltip");
assert.equal(help.parentElement, document.body, "narrow/overflowing columns must not constrain tooltip width");
assert.equal(helpButton.getAttribute("aria-describedby"), help.id);
assert.equal(help.style.top, "124px");
assert.ok(help.classList.contains("inset-x-4"));
anchorTop = 700;
fireEvent.resize(window);
assert.equal(help.style.top, "512px", "help must move above the trigger near the viewport bottom");
anchorTop = 200;
fireEvent.scroll(window);
assert.equal(help.style.top, "224px");
fireEvent.mouseLeave(helpButton.parentElement);
assert.equal(screen.queryByRole("tooltip"), null);
fireEvent.focus(helpButton);
assert.ok(screen.getByRole("tooltip"));
fireEvent.keyDown(helpButton, { key: "Escape" });
assert.equal(screen.queryByRole("tooltip"), null);
fireEvent.blur(helpButton);
helpView.unmount();
HTMLElement.prototype.getBoundingClientRect = originalRect;
const { default: CatalogIntake } = await import("../app/admin/catalog/CatalogIntake.tsx");
const { default: CatalogEvidencePanel } = await import("../app/admin/catalog/CatalogEvidencePanel.tsx");
const { createEmptyCatalogDraft, newIngredientDraft } = await import("../app/admin/catalog/catalog-draft.ts");
const { identifyingFactors } = await import("../app/admin/catalog/catalog-intake.ts");
const id = "11111111-1111-4111-8111-111111111111";
const barcode = { value: "012345678905", format: "upc_a", gtin14: "00012345678905", packageSize: null };
const product = {
  id, labelName: "Zinc", brandName: "Example", physicalForm: "capsule", variant: null, marketRegion: "US", status: "draft", revision: 7,
  servingSize: { labelText: "One capsule", amount: 1, unit: "capsule" },
  components: [{ id: "ingredient", componentType: "ingredient", labelName: "Zinc", amountText: "30 mg" }],
  nutritionFacts: [], images: [], barcodes: [{ id: "barcode-a", labelBarcode: "111111111117", packageSize: { labelText: "60 capsules", amount: 60, unit: "capsules" } }],
  needsFollowUp: true, followUpReasons: ["legacy_formula_review"], adminNotes: "Check the formula",
};
const draft = { ...createEmptyCatalogDraft(), labelName: "Zinc", brandName: "Example", servingSizeLabelText: "One capsule",
  components: [{ ...newIngredientDraft("Zinc"), resolution: "not_in_research_library", amountDisclosureStatus: "disclosed", amountText: "30 mg" }] };
let calls = [];
let handler;
let saved = [];
let opened = [];
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } }); }
globalThis.fetch = async (url, options = {}) => {
  assert.ok(String(url).startsWith("/api/admin/catalog/") || String(url).startsWith("https://upload.invalid/"), `Unexpected network target: ${url}`);
  const request = { url: String(url), method: options.method ?? "GET", body: typeof options.body === "string" ? JSON.parse(options.body) : options.body };
  calls.push(request);
  const override = await handler?.(request);
  if (override) return override;
  if (request.url.includes("/barcodes/")) return json({ found: false, normalizedBarcode: barcode });
  if (request.url.includes("/products/search")) {
    const params = new URL(request.url, "https://local.invalid").searchParams;
    const match = params.get("exactLabelName")?.toLowerCase() === product.labelName.toLowerCase() && params.get("exactBrandName")?.toLowerCase() === product.brandName.toLowerCase();
    return json({ results: match ? [product] : [], nextCursor: null });
  }
  if (request.url === `/api/admin/catalog/products/${id}`) return json(product);
  if (request.url === "/api/admin/catalog/images/uploads") return json({ uploads: request.body.files.map((file) => ({ clientId: file.clientId, uploadHandle: file.role === "supplement_facts" ? `opaque-facts-${file.clientId}` : `opaque-${file.role}`, uploadUrl: `https://upload.invalid/${file.role}`, method: "PUT", requiredHeaders: {}, expiresAt: "2099-01-01T00:00:00Z" })) });
  if (request.url.startsWith("https://upload.invalid/")) return new Response(null, { status: 200 });
  if (request.url.endsWith("/templates/barcode")) return json({ status: "decoded", candidate: barcode, requiresConfirmation: true, warnings: [] });
  if (request.url.endsWith("/templates/front-label")) return json({ labelNameCandidates: ["Zinc"], brandNameCandidates: ["Example"], physicalFormCandidate: "capsule", variantCandidate: null, reviewReasons: [] });
  if (request.method === "POST" && request.url.includes("/products")) return json({ product: { ...product, revision: 8 } });
  throw new Error(`Unmocked request: ${request.method} ${request.url}`);
};
const click = (name) => fireEvent.click(screen.getByRole("button", { name }));
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const writes = () => calls.filter((call) => call.method === "POST" && /\/products(?:$|\/[^/]+\/barcodes$)/.test(call.url));
function seed(extra = {}) {
  localStorage.setItem("suppvis:admin-catalog:intake:v1", JSON.stringify({ version: 1, draft, barcode: { value: "", format: "upc_a" }, mode: "none", sources: { barcode: "skipped", front_label: "skipped", supplement_facts: "skipped" }, files: [], ...extra }));
}
async function start(extra, override) {
  cleanup(); localStorage.clear(); calls = []; saved = []; opened = []; handler = override;
  if (extra) seed(extra);
  render(React.createElement(CatalogIntake, { onSaved: (id) => saved.push(id), onOpen: (id) => opened.push(id) }));
  await screen.findByText("Source images");
}
async function manualBarcode() {
  click("Manually type barcode digits"); type("Printed/decoded digits", barcode.value);
  fireEvent.click(screen.getByLabelText("I confirmed the digits against the package"));
  await screen.findByText(/No existing barcode found/);
}
async function searchAndCompare() {
  await screen.findByText("Potential matching products");
  click(/Example · Zinc.*draft/); await screen.findByText("Formula per serving");
}
function confirmFactors() { for (const factor of identifyingFactors) fireEvent.click(screen.getByLabelText(factor)); }
async function upload(roleIndex, name = "barcode.png") {
  const file = new File([new Uint8Array([137,80,78,71])], name, { type: "image/png" });
  fireEvent.change(document.querySelectorAll('input[type="file"]')[roleIndex], { target: { files: [file] } });
  await waitFor(() => assert.ok(calls.some((call) => call.url.startsWith("https://upload.invalid/"))));
  await waitFor(() => assert.equal(document.querySelector('input[type="file"]').disabled, false));
}

// Explicit gate, manual mode, and failed search cannot bypass duplicate review.
await start();
assert.equal(screen.queryByText("Product label"), null);
assert.equal(document.querySelectorAll("h3")[0].textContent, "Barcode");
click(/Skip all images/);
assert.ok(screen.getByLabelText("Intake product name"));
assert.equal(screen.queryByText("Formula sources"), null);
assert.equal(screen.queryByLabelText("Printed/decoded digits"), null);
type("Intake product name", "Zinc"); type("Intake brand", "Example");
handler = (r) => r.url.includes("/products/search") ? json({ error: { code: "UNAVAILABLE", message: "Search failed" } }, 503) : null;
await screen.findByText("Search failed");
assert.equal(screen.queryByRole("button", { name: /No match/ }), null);
handler = (r) => r.url.includes("/products/search") ? json({ results: [], nextCursor: null }) : null;
click("Retry product check"); await screen.findByText("No matches found. Continue with the new product below.");
assert.ok(screen.getByText("Product label"));
assert.equal(screen.queryByText("Formula sources"), null);
assert.equal(writes().length, 0);

// A barcode-free manual product can save, but never creates an empty barcode/package row.
await start({}, (r) => r.url.includes("/products/search") ? json({ results: [], nextCursor: null }) : null);
await screen.findByText("No matches found. Continue with the new product below.");
assert.equal(screen.getByRole("button", { name: "Save draft" }).disabled, false);
click("Save draft"); await waitFor(() => assert.equal(saved.length, 1));
assert.equal(writes().length, 1); assert.equal(writes()[0].body.barcode, undefined); assert.deepEqual(writes()[0].body.imageSets, []);

// Uploaded barcode decodes/checks immediately; unresolved other sources are not required for an exact match.
await start(null, (r) => r.url.includes("/barcodes/") ? json({ found: true, normalizedBarcode: barcode, barcode: { id: "barcode", revision: 1 }, product }) : null);
await upload(0);
await screen.findByText("This barcode is already in the database");
assert.ok(screen.getByAltText("Uploaded barcode label for digit verification"));
assert.equal(screen.queryByRole("button", { name: /View image|Hide image|Lookup barcode/i }), null);
assert.equal(screen.getByRole("button", { name: /Review \/ edit/ }).disabled, true);
assert.ok(screen.getByText(/Worth reviewing/));
fireEvent.click(screen.getByLabelText("I confirmed the digits against the package")); click(/Review \/ edit/);
assert.deepEqual(opened, [id]); assert.equal(writes().length, 0);

// Decode failures retain the image and allow manual digit recovery. Invalid digits never reach lookup.
await start(null, (r) => r.url.endsWith("/templates/barcode") ? json({ status: "manual_required", candidate: null, reason: "not_found" }) : null);
await upload(0); await screen.findByText(/Barcode could not be decoded/);
assert.ok(screen.getByAltText("Uploaded barcode label for digit verification"));
click("Manually type barcode digits"); type("Printed/decoded digits", "000000000000");
await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
assert.equal(calls.filter((call) => call.url.includes("/barcodes/")).length, 0);
type("Printed/decoded digits", barcode.value); await screen.findByText(/No existing barcode found/);

// Drag/drop follows the same automatic upload/OCR path; failures require an explicit decision.
await start({}, (r) => r.url.endsWith("/templates/front-label") ? json({ error: { code: "IMAGE_PROCESSING_FAILED", message: "OCR failed" } }, 422) : null);
const frontDrop = document.querySelectorAll('input[type="file"]')[1].closest("label");
fireEvent.drop(frontDrop, { dataTransfer: { types: ["Files"], files: [new File(["image fixture"], "front.png", { type: "image/png" })] } });
await screen.findByText("OCR failed");
assert.ok(screen.getByLabelText("Intake product name"), "identity fields remain available while another source fails");
click("Keep image, enter details manually");
assert.ok(screen.getByLabelText("Intake product name"));
assert.equal(writes().length, 0);

// Failed automatic lookup is retried explicitly; an older in-flight response cannot win.
let failLookup = true;
await start({}, (r) => r.url.includes("/barcodes/") && failLookup ? json({ error: { code: "UNAVAILABLE", message: "Lookup unavailable" } }, 503) : null);
click("Manually type barcode digits"); type("Printed/decoded digits", barcode.value);
await screen.findByText("Lookup unavailable");
assert.ok(screen.getByLabelText("Intake product name"), "identity fields remain available while another source fails");
failLookup = false; click("Retry failed barcode check"); await screen.findByText(/No existing barcode found/);

let releaseLookup;
await start({}, (r) => r.url.includes(`/barcodes/${barcode.value}`) ? new Promise((resolve) => { releaseLookup = resolve; }) : null);
click("Manually type barcode digits"); type("Printed/decoded digits", barcode.value);
await waitFor(() => assert.equal(typeof releaseLookup, "function"));
type("Printed/decoded digits", "036000291452"); await screen.findByText(/No existing barcode found/);
await act(async () => { releaseLookup(json({ found: true, normalizedBarcode: barcode, barcode: { id: "stale", revision: 1 }, product })); });
assert.equal(screen.queryByText("This barcode is already in the database"), null);

// A match attaches only the new barcode evidence, with every factor confirmed and a revision guard.
await start({ files: [{ role: "front_label", clientId: "front", fileName: "front.png", status: "uploaded", uploadHandle: "opaque-front", byteSize: 20, expiresAt: "2099-01-01" }], sources: { barcode: "undecided", front_label: "ready", supplement_facts: "skipped" }, mode: "undecided" });
await upload(0); await screen.findByText(/No existing barcode found/);
fireEvent.click(screen.getByLabelText("I confirmed the digits against the package"));
await searchAndCompare();
assert.equal(screen.getByRole("button", { name: "Use this matching draft" }).disabled, true);
confirmFactors(); click("Use this matching draft");
assert.equal(screen.queryByText("Product label"), null);
type("Package label", "120 capsules"); type("Package amount", "120"); type("Package unit", "capsules");
click("Save draft"); await waitFor(() => assert.equal(saved.length, 1));
assert.equal(writes().length, 1); assert.equal(writes()[0].url, `/api/admin/catalog/products/${id}/barcodes`);
assert.equal(writes()[0].body.expectedRevision, 7);
assert.deepEqual(writes()[0].body.imageSets, [{ role: "barcode", action: "append", uploadHandles: ["opaque-barcode"] }]);
assert.equal(writes()[0].body.product, undefined);

// A failed attachment retains pending evidence; retry is still confined to Save draft.
let failAttach = true;
await start({}, (r) => r.method === "POST" && r.url.endsWith("/barcodes") && failAttach ? json({ error: { code: "OBJECT_STORAGE_UNAVAILABLE", message: "Storage unavailable" } }, 503) : null);
await manualBarcode(); await searchAndCompare(); confirmFactors(); click("Use this matching draft"); click("Save draft");
await screen.findByText(/Storage unavailable/); failAttach = false; click("Save draft");
await waitFor(() => assert.equal(saved.length, 1)); assert.equal(writes().length, 2);

// Stale revision reloads the product and requires a complete fresh comparison.
await start({}, (r) => r.method === "POST" && r.url.endsWith("/barcodes") ? json({ error: { code: "REVISION_CONFLICT", message: "Changed" } }, 409) : null);
await manualBarcode(); await searchAndCompare(); confirmFactors(); click("Use this matching draft"); click("Save draft");
await screen.findByText(/The matched product changed/);
assert.equal(screen.getByRole("button", { name: "Use this matching draft" }).disabled, true);
for (const factor of identifyingFactors) assert.equal(screen.getByLabelText(factor).checked, false);

// Published and retired matches are visible but never writable through intake.
for (const status of ["published", "retired"]) {
  await start({}, (r) => r.url === `/api/admin/catalog/products/${id}` ? json({ ...product, status }) : null);
  await manualBarcode(); await searchAndCompare(); confirmFactors();
  assert.ok(screen.getByText(new RegExp(`This product is ${status}`)));
  assert.equal(screen.queryByRole("button", { name: "Use this matching draft" }), null);
  assert.equal(screen.queryByRole("button", { name: "Save draft" }), null);
  click("Product already exists — finish without changes"); assert.equal(writes().length, 0);
}

// Without digits, matching an existing draft can only finish; there is no barcode-less package write.
await start({}); await searchAndCompare(); confirmFactors();
assert.ok(screen.getByText(/Adding a barcode-less package size is out of scope/));
click("Product already exists — finish without changes"); assert.equal(writes().length, 0);

// Concurrent assignment discovered by the final read prevents a second mutation.
let barcodeReads = 0;
await start({}, (r) => r.url.includes("/barcodes/") && ++barcodeReads > 1 ? json({ found: true, normalizedBarcode: barcode, barcode: { id: "new", revision: 1 }, product }) : null);
await manualBarcode(); await searchAndCompare(); confirmFactors(); click("Use this matching draft"); click("Save draft");
await screen.findByText("This barcode is already in the database"); assert.equal(writes().length, 0);

// OCR fills name/brand directly; admins may correct them before an exact, all-status check.
await start({ draft: { ...draft, labelName: "Old label", brandName: "Old brand" } });
await upload(1, "front.png");
await waitFor(() => assert.equal(screen.getByLabelText("Intake product name").value, "Zinc"));
assert.equal(screen.getByLabelText("Intake brand").value, "Example");
assert.equal(screen.queryByRole("button", { name: /Use source (label|brand|form|variant)/ }), null);
type("Intake product name", "ZINC"); type("Intake brand", "EXAMPLE");
await screen.findByText("Potential matching products");
const identityRequests = calls.filter((call) => call.url.includes("/products/search"));
assert.equal(identityRequests.length, 1, "identity must use one paired request, not two broad searches");
const identityParams = new URL(identityRequests[0].url, "https://local.invalid").searchParams;
assert.equal(identityParams.get("q"), null);
assert.equal(identityParams.get("exactLabelName"), "ZINC");
assert.equal(identityParams.get("exactBrandName"), "EXAMPLE");
assert.equal(identityParams.get("status"), "all");
assert.ok(screen.getByRole("button", { name: /Example · Zinc.*draft/ }));
assert.equal(screen.queryByText("Product label"), null);

// Pagination retains both exact terms, and multiple exact matches remain reviewable.
await start({}, (r) => {
  if (!r.url.includes("/products/search")) return null;
  const params = new URL(r.url, "https://local.invalid").searchParams;
  assert.equal(params.get("exactLabelName"), "Zinc");
  assert.equal(params.get("exactBrandName"), "Example");
  return params.has("cursor")
    ? json({ results: [{ ...product, id: "second-exact-match", status: "retired" }], nextCursor: null })
    : json({ results: [product], nextCursor: "next-exact-page" });
});
await screen.findByText("Potential matching products");
click("Load more potential matches"); await screen.findByRole("button", { name: /Example · Zinc.*retired/ });
assert.ok(screen.getByRole("button", { name: /Example · Zinc.*draft/ }));
assert.equal(screen.queryByRole("button", { name: "Load more potential matches" }), null);

// Unexpected broad results (e.g. an older backend) must not present false matches or open creation.
await start({}, (r) => r.url.includes("/products/search") ? json({ results: [{ ...product, labelName: "Zinc extra" }], nextCursor: null }) : null);
await screen.findByText(/identity check returned unexpected results/);
assert.equal(screen.queryByText("Potential matching products"), null);
assert.equal(screen.getByRole("button", { name: "Save draft" }).disabled, true);

// Changes other than letter case are not potential matches and require no extra "No match" click.
for (const [name, brand] of [["Zinc extra", "Example"], ["Zinc", "Example extra"], ["Zin", "Example"], ["Zinc", "Exámple"], ["Zi-nc", "Example"], ["Zinc  30 mg", "Example"]]) {
  await start({ draft: { ...draft, labelName: name, brandName: brand } }, (r) => r.url.includes("/products/search") ? json({ results: [], nextCursor: null }) : null);
  await screen.findByText("No matches found. Continue with the new product below.");
  assert.ok(screen.getByText("Product label"));
  assert.equal(screen.queryByRole("button", { name: /No match/ }), null);
  assert.equal(writes().length, 0);
}

// A late identity response cannot reopen the new-product form for corrected input.
let releaseIdentity;
await start({}, (r) => r.url.includes("/products/search") ? new Promise((resolve) => { releaseIdentity = resolve; }) : null);
await waitFor(() => assert.equal(typeof releaseIdentity, "function"));
type("Intake brand", "Corrected brand");
await act(async () => { releaseIdentity(json({ results: [], nextCursor: null })); });
assert.equal(screen.getByRole("button", { name: "Save draft" }).disabled, true);

// Front-label OCR matches before the other source choices and lives inside its image card.
await start();
await upload(1, "front-first.png");
await screen.findByText("Potential matching products");
assert.equal(screen.getByLabelText("Intake product name").closest("[data-source-role]").dataset.sourceRole, "front_label");
assert.equal(screen.getByText("Potential matching products").closest("[data-source-role]").dataset.sourceRole, "front_label");
assert.equal(screen.queryByRole("button", { name: "Find potential matches" }), null);
assert.equal(document.querySelector('[data-source-role="supplement_facts"] input[type="file"]').disabled, false);
assert.equal(calls.some((request) => request.url.endsWith("/templates/ocr")), false);
assert.equal(screen.queryByText("Product label"), null, "unselected image choices still gate the full editor");
type("Intake brand", "Different brand");
await screen.findByText("No matches found. Continue with the new product below.");
assert.equal(new URL(calls.filter((request) => request.url.includes("/products/search")).at(-1).url, "https://local.invalid").searchParams.get("exactBrandName"), "Different brand");

// Concurrent roles and adding more panels during OCR preserve all files; only latest analysis wins.
let finishFront;
const factRuns = [];
const factsCandidate = (name) => ({ candidate: { templateId: name, source: "ocr_template", sourceLabel: name, components: [], nutritionFacts: [], reviewReasons: [] } });
await start(null, (request) => {
  if (request.url.endsWith("/templates/front-label")) return new Promise((resolve) => { finishFront = resolve; });
  if (request.url.endsWith("/templates/ocr")) return new Promise((resolve) => { factRuns.push({ resolve, body: request.body }); });
  return null;
});
await upload(1, "front-delayed.png");
await waitFor(() => assert.equal(typeof finishFront, "function"));
await upload(2, "facts-one.png");
await waitFor(() => assert.equal(factRuns.length, 1));
assert.equal(document.querySelector('[data-source-role="supplement_facts"] input[type="file"]').disabled, false,
  "another panel may be added while Supplement Facts OCR runs");
await upload(2, "facts-two.png");
await waitFor(() => assert.equal(factRuns.length, 2));
assert.equal(factRuns[0].body.imageUploadHandles.length, 1);
assert.equal(factRuns[1].body.imageUploadHandles.length, 2);
await upload(0, "barcode-concurrent.png");
await screen.findByText(/No existing barcode found/);
assert.ok(screen.getByText("Product label"), "fields are editable before front/facts OCR completes");
assert.equal(screen.getByRole("button", { name: "Save draft" }).disabled, true);
type("Intake product name", "Manually corrected label");
await act(async () => { factRuns[1].resolve(json(factsCandidate("Newest combined facts"))); });
await screen.findByText("Newest combined facts");
await act(async () => { factRuns[0].resolve(json(factsCandidate("Stale one-panel facts"))); });
assert.equal(screen.queryByText("Stale one-panel facts"), null);
await act(async () => { finishFront(json({ labelNameCandidates: ["Stale OCR label"], brandNameCandidates: ["Example"], physicalFormCandidate: null, variantCandidate: null, reviewReasons: [] })); });
assert.equal(screen.getByLabelText("Intake product name").value, "Manually corrected label", "late OCR must not overwrite manual edits");
assert.equal(screen.getByLabelText("Intake brand").value, "Example", "an untouched field still receives OCR prefill");
await waitFor(() => {
  const preserved = JSON.parse(localStorage.getItem("suppvis:admin-catalog:intake:v1"));
  assert.equal(preserved.files.length, 4);
  assert.ok(preserved.files.every((file) => file.status === "uploaded"));
  assert.deepEqual(preserved.files.filter((file) => file.role === "supplement_facts").map((file) => file.fileName), ["facts-one.png", "facts-two.png"]);
});

// Reordering while analysis is pending invalidates the previous ordered-set result.
const factsSection = document.querySelector('[data-source-role="supplement_facts"]');
fireEvent.click(factsSection.querySelectorAll('[aria-label="Move image earlier"]')[1]);
await waitFor(() => assert.equal(factRuns.length, 3));
assert.deepEqual(factRuns[2].body.imageUploadHandles, [...factRuns[1].body.imageUploadHandles].reverse());
await act(async () => { factRuns[2].resolve(json(factsCandidate("Reordered combined facts"))); });
await screen.findByText("Reordered combined facts");
assert.equal(screen.queryByText("Newest combined facts"), null);

// Uploads in different columns can overlap and complete in reverse order without losing evidence.
const pendingPuts = new Map();
await start(null, (request) => {
  if (request.url.startsWith("https://upload.invalid/")) return new Promise((resolve) => pendingPuts.set(request.url, resolve));
  if (request.url.endsWith("/templates/ocr")) return json(factsCandidate("Parallel facts"));
  return null;
});
for (const [index, name] of [[1, "parallel-front.png"], [2, "parallel-facts.png"]]) {
  fireEvent.change(document.querySelectorAll('input[type="file"]')[index], { target: { files: [new File(["fixture"], name, { type: "image/png" })] } });
}
await waitFor(() => assert.equal(pendingPuts.size, 2));
assert.equal(document.querySelector('[data-source-role="barcode"] input[type="file"]').disabled, false);
await act(async () => { pendingPuts.get("https://upload.invalid/supplement_facts")(new Response(null, { status: 200 })); });
await act(async () => { pendingPuts.get("https://upload.invalid/front_label")(new Response(null, { status: 200 })); });
await screen.findByText("Potential matching products");
await waitFor(() => {
  const preserved = JSON.parse(localStorage.getItem("suppvis:admin-catalog:intake:v1"));
  assert.equal(preserved.files.length, 2);
  assert.ok(preserved.files.every((file) => file.status === "uploaded"));
});

// Replacing a front image during OCR ignores the discarded image's eventual result.
const frontRuns = [];
await start(null, (request) => request.url.endsWith("/templates/front-label") ? new Promise((resolve) => frontRuns.push(resolve)) : null);
await upload(1, "old-front.png");
await waitFor(() => assert.equal(frontRuns.length, 1));
await upload(1, "new-front.png");
await waitFor(() => assert.equal(frontRuns.length, 2));
await act(async () => { frontRuns[1](json({ labelNameCandidates: ["Newest label"], brandNameCandidates: ["Newest brand"], reviewReasons: [] })); });
await act(async () => { frontRuns[0](json({ labelNameCandidates: ["Stale label"], brandNameCandidates: ["Stale brand"], reviewReasons: [] })); });
assert.equal(screen.getByLabelText("Intake product name").value, "Newest label");
assert.equal(screen.getByLabelText("Intake brand").value, "Newest brand");
assert.equal(screen.queryByText(/old-front.png/), null);

// Skipping all sources during OCR cancels late state changes and keeps manual identity intact.
let abandonedFront;
await start(null, (request) => request.url.endsWith("/templates/front-label") ? new Promise((resolve) => { abandonedFront = resolve; }) : null);
await upload(1, "abandoned.png");
await waitFor(() => assert.equal(typeof abandonedFront, "function"));
click(/Skip all images/);
type("Intake product name", "Manual label"); type("Intake brand", "Manual brand");
await act(async () => { abandonedFront(json({ labelNameCandidates: ["Discarded label"], brandNameCandidates: ["Discarded brand"], reviewReasons: [] })); });
assert.equal(screen.getByLabelText("Intake product name").value, "Manual label");
assert.equal(screen.getByLabelText("Intake brand").value, "Manual brand");
assert.equal(screen.queryByText(/abandoned.png/), null);

// An editor changing products without unmounting its evidence panel rejects the old OCR result.
cleanup(); calls = [];
const resetFrontRuns = [];
const acceptedFrontLabels = [];
handler = (request) => request.url.endsWith("/templates/front-label") ? new Promise((resolve) => resetFrontRuns.push(resolve)) : null;
function ResetEvidenceHarness() {
  const [files, setFiles] = React.useState([]);
  return React.createElement(React.Fragment, null,
    React.createElement("button", { onClick: () => setFiles([]) }, "Open another product"),
    React.createElement(CatalogEvidencePanel, { files, onChange: setFiles,
      onFrontCandidate: (candidate) => acceptedFrontLabels.push(candidate.labelNameCandidates[0]),
      onBarcodeCandidate: () => {}, onFormulaCandidate: () => {} }));
}
render(React.createElement(ResetEvidenceHarness));
await upload(0, "previous-product.png");
await waitFor(() => assert.equal(resetFrontRuns.length, 1));
click("Open another product");
await act(async () => { resetFrontRuns[0](json({ labelNameCandidates: ["Wrong product"], brandNameCandidates: [], reviewReasons: [] })); });
assert.deepEqual(acceptedFrontLabels, []);
assert.equal(screen.queryByText(/previous-product.png/), null);
await upload(0, "current-product.png");
await waitFor(() => assert.equal(resetFrontRuns.length, 2));
await act(async () => { resetFrontRuns[1](json({ labelNameCandidates: ["Current product"], brandNameCandidates: [], reviewReasons: [] })); });
assert.deepEqual(acceptedFrontLabels, ["Current product"]);

// Editing the confirmed name/brand invalidates a previous no-match decision.
await start({}, (r) => r.url.includes("/products/search") ? json({ results: [], nextCursor: null }) : null);
await screen.findByText("No matches found. Continue with the new product below.");
type("Brand", "Another brand"); assert.equal(screen.getByRole("button", { name: "Save draft" }).disabled, true);

await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
assert.ok(localStorage.getItem("suppvis:admin-catalog:intake:v1").includes("Another brand"));
cleanup(); dom.window.close();
console.log("Catalog intake component acceptance passed: source gate, manual create, immediate duplicate, decode fallback, guarded attachment, concurrency, lifecycle stops, and recovery.");
