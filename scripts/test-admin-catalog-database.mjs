import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canOpenCatalogWorkspace,
  catalogDatabaseHasActiveFilters,
  catalogDatabaseStateFromParams,
  catalogDatabaseUrlParams,
  catalogEvidenceSummary,
  catalogPrimaryIdentity,
  defaultCatalogDatabaseFilters,
  defaultCatalogDatabaseSort,
  nextCatalogDatabaseSort,
} from "../app/admin/catalog/catalog-database.ts";

const summary = {
  id: "11111111-1111-4111-8111-111111111111",
  productType: "supplement",
  status: "draft",
  labelName: "Creatine",
  brandName: "Example",
  physicalForm: "powder",
  variant: null,
  marketRegion: "US",
  primaryCanonicalKey: "creatine",
  servingSize: { labelText: "1 scoop", amount: 1, unit: "scoop" },
  revision: 1,
  updatedAt: "2026-09-03T12:00:00.000Z",
  activeLeafCount: 1,
  barcodeCount: 2,
  imageCount: 3,
  nutritionFactCount: 0,
  needsFollowUp: false,
  followUpReasons: [],
};

assert.equal(catalogPrimaryIdentity(summary), "creatine");
assert.equal(catalogPrimaryIdentity({ ...summary, primaryCanonicalKey: null }), "Not in research library");
assert.equal(catalogPrimaryIdentity({ ...summary, productType: "blend", primaryCanonicalKey: null }), "Multiple ingredients");
assert.equal(catalogEvidenceSummary(summary), "3 images");
assert.equal(catalogEvidenceSummary({ ...summary, imageCount: 0 }), "No evidence");
assert.equal(canOpenCatalogWorkspace({ status: "draft" }), true);
assert.equal(canOpenCatalogWorkspace({ status: "published" }), false);
assert.equal(canOpenCatalogWorkspace({ status: "retired" }), false);

let sort = nextCatalogDatabaseSort(null, "product");
assert.deepEqual(sort, { key: "product", direction: "ascending" });
sort = nextCatalogDatabaseSort(sort, "product");
assert.deepEqual(sort, { key: "product", direction: "descending" });
sort = nextCatalogDatabaseSort(sort, "product");
assert.equal(sort, null, "the third click must restore original catalog order");
assert.deepEqual(nextCatalogDatabaseSort({ key: "brand", direction: "descending" }, "status"), {
  key: "status",
  direction: "ascending",
});

for (const query of ["", "view=database", "view=database&status=draft"]) {
  assert.deepEqual(catalogDatabaseStateFromParams(new URLSearchParams(query)).sort,
    { key: "updated", direction: "descending" },
    "database views without an explicit sort must show recently updated products first");
}
assert.deepEqual(
  catalogDatabaseStateFromParams(new URLSearchParams("sort=brand&direction=ascending")).sort,
  { key: "brand", direction: "ascending" },
  "explicit saved sorts must override the default",
);
const noSort = nextCatalogDatabaseSort(defaultCatalogDatabaseSort, "updated");
assert.equal(noSort, null, "the default descending sort must retain the header's three-state cycle");
const noSortParams = catalogDatabaseUrlParams(
  new URLSearchParams("sort=updated&direction=descending"), defaultCatalogDatabaseFilters, noSort,
);
assert.equal(noSortParams.get("sort"), "none");
assert.equal(noSortParams.get("direction"), null);
assert.equal(catalogDatabaseStateFromParams(noSortParams).sort, null,
  "an explicit no-sort selection must survive URL round trips");

const urlState = catalogDatabaseStateFromParams(new URLSearchParams(
  "view=database&q=creatine&status=retired&type=blend&review=needs-review&evidence=missing&sort=updated&direction=descending",
));
assert.deepEqual(urlState, {
  filters: {
    query: "creatine",
    status: "retired",
    productType: "blend",
    review: "needs-review",
    evidence: "missing",
  },
  sort: { key: "updated", direction: "descending" },
});
assert.equal(catalogDatabaseHasActiveFilters(urlState.filters), true);
assert.equal(catalogDatabaseHasActiveFilters(defaultCatalogDatabaseFilters), false);
const serialized = catalogDatabaseUrlParams(
  new URLSearchParams("view=database&product=old"),
  urlState.filters,
  urlState.sort,
);
assert.equal(serialized.get("product"), null);
assert.equal(serialized.get("q"), "creatine");
assert.equal(serialized.get("status"), "retired");
assert.equal(serialized.get("sort"), "updated");
assert.equal(serialized.get("direction"), "descending");
assert.deepEqual(
  catalogDatabaseStateFromParams(new URLSearchParams("status=bad&type=bad&sort=bad&direction=descending")),
  { filters: defaultCatalogDatabaseFilters, sort: defaultCatalogDatabaseSort },
  "unsupported URL state must fail closed to the default database view",
);

const databaseSource = readFileSync("app/admin/catalog/CatalogDatabase.tsx", "utf8");
const workspaceSource = readFileSync("app/admin/catalog/CatalogWorkspace.tsx", "utf8");
const pageSource = readFileSync("app/admin/catalog/page.tsx", "utf8");
const evidenceSource = readFileSync("app/admin/catalog/CatalogEvidencePanel.tsx", "utf8");

assert.match(databaseSource, /status: filters\.status/,
  "the database view must pass its lifecycle filter to the paginated read contract");
assert.match(databaseSource, /q: debouncedQuery \|\| undefined/,
  "global search must be debounced before reaching the read API");
assert.match(databaseSource, /sortBy: sort\?\.key/,
  "sorting must be sent to the backend so it applies before pagination");
assert.match(databaseSource, /router\.replace\(/,
  "search, filters, and sorting must be retained in the URL");
assert.match(databaseSource, /if \(willExpand && !details\[productId\]\) void loadDetail\(productId\)/,
  "complete product records must load only after their row expands");
assert.match(databaseSource, /onToggle=\{onImagesToggle\}/);
assert.match(databaseSource, /if \(open\) void loadImages\(\)/,
  "private image access must begin only after the image section expands");
assert.match(databaseSource, /canOpenCatalogWorkspace\(product\)[\s\S]*Open in workspace/,
  "only the lifecycle policy helper may expose the workspace action");
for (const mutation of ["createCatalogProduct", "updateCatalogProduct", "attachCatalogBarcode", "reassignCatalogBarcode"]) {
  assert.doesNotMatch(databaseSource, new RegExp(mutation), `${mutation} must not enter the read-only database view`);
}

assert.match(workspaceSource, /status: "draft",\s*needsFollowUp: true/,
  "the editor browser must remain a draft-only review queue");
assert.match(workspaceSource, /Review queue/);
assert.match(pageSource, />\s*Add \/ edit catalog\s*</);
assert.match(pageSource, />\s*Catalog database\s*</);
assert.match(databaseSource, /view=workspace&product=/,
  "database rows must deep-link to the product-level workspace");
assert.match(databaseSource, /aria-sort=\{activeDirection \?\? "none"\}/,
  "sortable headers must expose their current direction to assistive technology");
for (const column of ["product", "brand", "type", "status", "identity", "barcodes", "ingredients", "evidence", "followUp", "updated"]) {
  assert.match(databaseSource, new RegExp(`column="${column}"`), `${column} must have a sortable header`);
}
for (const filterLabel of ["Search catalog", "Status", "Type", "Review", "Evidence"]) {
  assert.match(databaseSource, new RegExp(filterLabel), `${filterLabel} must be exposed in the database toolbar`);
}
assert.match(databaseSource, /No products match the current search and filters\./);
assert.match(evidenceSource, /onDragEnter=/);
assert.match(evidenceSource, /onDragOver=/);
assert.match(evidenceSource, /onDrop=/);
assert.match(evidenceSource, /event\.dataTransfer\.files/,
  "dropped image files must enter the same validated evidence-selection path as browsed files");
assert.match(evidenceSource, /Drag and drop here, or click to browse/);
assert.match(evidenceSource, /Saving this draft will supersede the current stored image/,
  "single-image evidence replacement must require an explicit warning");
assert.match(evidenceSource, /await uploadRole\(role, next/,
  "selecting or dropping evidence must start its private upload automatically");
assert.match(evidenceSource, /await analyze\(role, working\)/,
  "a successful private upload must trigger role-specific analysis automatically");
assert.doesNotMatch(evidenceSource, /Upload pending|Decode bars|Analyze source/,
  "automatic evidence processing must not expose redundant manual action buttons");

console.log("Website admin catalog database view checks passed.");
