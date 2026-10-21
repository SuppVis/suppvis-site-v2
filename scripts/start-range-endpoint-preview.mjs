/** Read-only local preview for the frozen serving-range endpoint queue. */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const siteRoot = resolve(import.meta.dirname, "..");
const fixturePath = process.env.SERVING_RANGE_ENDPOINT_FIXTURE;
const ocrDirectory = process.env.SERVING_RANGE_OCR_DIR
  ? resolve(process.env.SERVING_RANGE_OCR_DIR) : null;
if (!fixturePath) throw new Error("SERVING_RANGE_ENDPOINT_FIXTURE is required.");

const fixture = JSON.parse(readFileSync(resolve(fixturePath), "utf8"));
const siteConfig = parseEnv(readFileSync(resolve(siteRoot, ".env.local"), "utf8"));

for (const key of ["AUTH_SECRET", "AUTH_MICROSOFT_ENTRA_ID_ID", "AUTH_MICROSOFT_ENTRA_ID_SECRET",
  "AUTH_MICROSOFT_ENTRA_ID_ISSUER", "ADMIN_ALLOWED_EMAILS", "CATALOG_ADMIN_BRIDGE_SECRET"]) {
  if (!siteConfig[key]?.trim()) throw new Error(`Local admin configuration is missing ${key}.`);
}
if (fixture.batchKey !== "dsld-serving-range-endpoint-2026-10-21-v1"
  || fixture.tasks.length !== 1076) {
  throw new Error("The frozen serving-range endpoint preview fixture is invalid.");
}

function taskId(labelId) {
  return `00000000-0000-4000-8000-${String(labelId).padStart(12, "0")}`;
}

function summary(task) {
  return {
    id: taskId(task.dsldLabelId),
    queueOrdinal: task.queueOrdinal,
    dsldLabelId: task.dsldLabelId,
    labelName: task.labelName,
    brandName: task.brandName,
    offMarket: task.offMarket,
    status: "pending",
    revision: 0,
    flagCodes: [],
    warningSeverity: task.warningSeverity,
    reviewReasonCodes: task.reviewReasonCodes,
    reviewCategory: task.reviewCategory,
    resolutionKind: task.resolutionKind,
    exclusionReason: null,
    selectedRangeEndpoint: null,
    componentCount: 0,
  };
}

const tasks = fixture.tasks.map(summary);
const byId = new Map(fixture.tasks.map((task) => [taskId(task.dsldLabelId), task]));

function json(response, status, value) {
  response.writeHead(status, {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

const mockPlatform = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3001");
  if (request.method === "GET" && url.pathname === "/api/admin/catalog/serving-size-review") {
    json(response, 200, {
      batchKey: "serving-range-endpoint-local-preview-v1",
      tasks,
      progress: { total: 1076, pending: 1076, escalated: 0, decided: 0 },
    });
    return;
  }
  const ocrMatch = request.method === "GET"
    ? url.pathname.match(/^\/api\/admin\/catalog\/group1-review\/labels\/([1-9][0-9]{0,9})\/ocr$/)
    : null;
  if (ocrMatch) {
    const path = ocrDirectory ? resolve(ocrDirectory, `${ocrMatch[1]}.json`) : null;
    if (!path || !existsSync(path)) {
      json(response, 404, { error: { code: "INVALID_REQUEST", message: "Preview OCR is not ready." } });
      return;
    }
    json(response, 200, JSON.parse(readFileSync(path, "utf8")));
    return;
  }
  const match = request.method === "GET"
    ? url.pathname.match(/^\/api\/admin\/catalog\/serving-size-review\/tasks\/([0-9a-f-]+)$/i)
    : null;
  if (match) {
    const task = byId.get(match[1]);
    if (!task) {
      json(response, 404, { error: { code: "INVALID_REQUEST", message: "Preview task not found." } });
      return;
    }
    json(response, 200, {
      ...summary(task),
      sourceCandidateSha256: task.sourceCandidateSha256,
      productType: task.productType,
      labelPdfUrl: task.labelPdfUrl,
      sourceServingSizes: task.sourceServingSizes,
      sourceContexts: task.sourceContexts,
      reviewedServingContexts: null,
      policySuggestedServingOrder: null,
      policySelectionRule: task.policySelectionRule,
      sourceIngredientRows: task.sourceIngredientRows,
      repeatedIngredientNameGroups: task.repeatedIngredientNameGroups,
      selectedServingOrder: null,
      quantityOverrides: null,
      profileVariantRules: null,
      suggestedServingContext: null,
      sourceBundleComponents: [],
      bundleGroupKey: null,
      editionKey: null,
      editionGroupingConfidence: null,
      editionGroupingEvidence: [],
      exclusionReason: null,
      rangeEndpointOptions: task.rangeEndpointOptions,
      selectedRangeEndpoint: null,
      prescreenFlags: task.prescreenFlags,
      decisions: [],
    });
    return;
  }
  json(response, request.method === "GET" ? 404 : 403, {
    error: {
      code: "READ_ONLY_PREVIEW",
      message: "This local serving-range preview cannot save decisions.",
    },
  });
});

await new Promise((done, reject) => {
  mockPlatform.once("error", reject);
  mockPlatform.listen(3001, "127.0.0.1", done);
});

const inheritedEnv = Object.fromEntries(["PATH", "HOME", "TMPDIR", "USER", "SHELL"]
  .filter((name) => process.env[name]).map((name) => [name, process.env[name]]));
const child = spawn(process.execPath, [resolve(siteRoot, "node_modules/next/dist/bin/next"),
  "dev", "--hostname", "127.0.0.1", "--port", "3000"], {
  cwd: siteRoot,
  env: {
    ...inheritedEnv,
    NODE_ENV: "development",
    AUTH_SECRET: siteConfig.AUTH_SECRET,
    AUTH_MICROSOFT_ENTRA_ID_ID: siteConfig.AUTH_MICROSOFT_ENTRA_ID_ID,
    AUTH_MICROSOFT_ENTRA_ID_SECRET: siteConfig.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    AUTH_MICROSOFT_ENTRA_ID_ISSUER: siteConfig.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    ADMIN_ALLOWED_EMAILS: siteConfig.ADMIN_ALLOWED_EMAILS,
    AUTH_URL: "http://localhost:3000",
    AUTH_TRUST_HOST: "true",
    ADMIN_SITE_ORIGIN: "http://localhost:3000",
    CATALOG_PLATFORM_BASE_URL: "http://127.0.0.1:3001",
    CATALOG_ADMIN_BRIDGE_SECRET: siteConfig.CATALOG_ADMIN_BRIDGE_SECRET,
    NEXT_PUBLIC_SERVING_SIZE_REVIEW_READONLY: "1",
  },
  stdio: "inherit",
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill("SIGTERM");
  mockPlatform.close();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("error", (error) => {
  console.error(error.message);
  stop();
  process.exitCode = 1;
});
child.on("exit", (code) => {
  if (!stopping) {
    console.error(`The local preview server exited (${code}).`);
    stop();
    process.exitCode = code ?? 1;
  }
});

console.log("Serving-range preview: http://localhost:3000/admin/catalog/serving-size-review?category=range_endpoint_review");
console.log("The preview reads the frozen local fixture and cannot save decisions.");
