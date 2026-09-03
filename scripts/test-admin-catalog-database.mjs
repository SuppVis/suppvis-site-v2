import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canOpenCatalogWorkspace,
  catalogEvidenceSummary,
  catalogPrimaryIdentity,
  nextCatalogDatabaseSort,
  sortCatalogDatabaseProducts,
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

const products = [
  summary,
  {
    ...summary,
    id: "22222222-2222-4222-8222-222222222222",
    labelName: "Zinc",
    brandName: "Alpha",
    productType: "blend",
    status: "retired",
    primaryCanonicalKey: null,
    barcodeCount: 1,
    activeLeafCount: 3,
    imageCount: 0,
    needsFollowUp: true,
    updatedAt: "2026-09-01T12:00:00.000Z",
  },
  {
    ...summary,
    id: "33333333-3333-4333-8333-333333333333",
    labelName: "Ashwagandha",
    brandName: "Zulu",
    status: "published",
    primaryCanonicalKey: null,
    barcodeCount: 4,
    activeLeafCount: 2,
    imageCount: 1,
    updatedAt: "2026-09-02T12:00:00.000Z",
  },
];

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

function sortedIds(key, direction = "ascending") {
  return sortCatalogDatabaseProducts(products, { key, direction }).map((product) => product.id);
}

const [creatineId, zincId, ashwagandhaId] = products.map((product) => product.id);
assert.deepEqual(sortedIds("product"), [ashwagandhaId, creatineId, zincId]);
assert.deepEqual(sortedIds("brand"), [zincId, creatineId, ashwagandhaId]);
assert.deepEqual(sortedIds("type"), [zincId, creatineId, ashwagandhaId]);
assert.deepEqual(sortedIds("status"), [creatineId, ashwagandhaId, zincId]);
assert.deepEqual(sortedIds("identity"), [creatineId, zincId, ashwagandhaId]);
assert.deepEqual(sortedIds("barcodes"), [zincId, creatineId, ashwagandhaId]);
assert.deepEqual(sortedIds("ingredients"), [creatineId, ashwagandhaId, zincId]);
assert.deepEqual(sortedIds("evidence"), [zincId, ashwagandhaId, creatineId]);
assert.deepEqual(sortedIds("followUp"), [creatineId, ashwagandhaId, zincId]);
assert.deepEqual(sortedIds("updated"), [zincId, ashwagandhaId, creatineId]);
assert.deepEqual(sortedIds("product", "descending"), [zincId, creatineId, ashwagandhaId]);
assert.strictEqual(sortCatalogDatabaseProducts(products, null), products,
  "no sort must preserve the original array and order");

const databaseSource = readFileSync("app/admin/catalog/CatalogDatabase.tsx", "utf8");
const workspaceSource = readFileSync("app/admin/catalog/CatalogWorkspace.tsx", "utf8");
const pageSource = readFileSync("app/admin/catalog/page.tsx", "utf8");

assert.match(databaseSource, /searchCatalogProducts\(\{ status: "all", cursor, limit: 50 \}\)/,
  "the database view must include every lifecycle status through the paginated read contract");
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

console.log("Website admin catalog database view checks passed.");
