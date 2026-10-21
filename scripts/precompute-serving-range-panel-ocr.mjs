/** Local self-contained OCR worker for serving-range review label PDFs. */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

const run = promisify(execFile);
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_PAGES = 12;
const OCR_VERSION = "tesseract-psm11-psm6-v1";

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function selectedLabels() {
  const fixture = argument("--fixture");
  const labels = argument("--labels");
  if (Number(Boolean(fixture)) + Number(Boolean(labels)) !== 1) {
    throw new Error("Choose --fixture <seed JSON> or --labels <comma-separated DSLD IDs>.");
  }
  const values = fixture
    ? JSON.parse(readFileSync(resolve(fixture), "utf8")).tasks?.map((task) => task.dsldLabelId)
    : labels.split(",").map((value) => Number(value.trim()));
  if (!Array.isArray(values) || !values.length
    || values.some((value) => !Number.isSafeInteger(value) || value < 1)) {
    throw new Error("The requested DSLD label list is invalid.");
  }
  return [...new Set(values)].sort((left, right) => left - right);
}

function parseTsv(tsv, width, height) {
  const lines = new Map();
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const cells = row.split("\t");
    if (cells.length < 12 || cells[0] !== "5") continue;
    const text = cells.slice(11).join("\t").trim();
    const confidence = Number(cells[10]);
    const [x0, y0, wordWidth, wordHeight] = cells.slice(6, 10).map(Number);
    if (!text || !Number.isFinite(confidence) || confidence < 0
      || ![x0, y0, wordWidth, wordHeight].every(Number.isFinite)
      || x0 < 0 || y0 < 0 || wordWidth <= 0 || wordHeight <= 0
      || x0 + wordWidth > width || y0 + wordHeight > height) continue;
    const key = cells.slice(1, 5).join(":");
    const words = lines.get(key) ?? [];
    words.push({ text, confidence,
      box: { x0, y0, x1: x0 + wordWidth, y1: y0 + wordHeight } });
    lines.set(key, words);
  }
  return [...lines.values()];
}

async function ocrPage(document, pageNumber, workdir) {
  const page = await document.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = 2800 / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const width = Math.max(1, Math.round(viewport.width));
  const height = Math.max(1, Math.round(viewport.height));
  const canvas = createCanvas(width, height);
  await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
  const pngPath = join(workdir, `page-${pageNumber}.png`);
  await writeFile(pngPath, await canvas.encode("png"));
  const sparse = await run("tesseract", [pngPath, "stdout", "--psm", "11", "tsv"],
    { timeout: 90_000, maxBuffer: 32 * 1024 * 1024 });
  const block = await run("tesseract", [pngPath, "stdout", "--psm", "6", "tsv"],
    { timeout: 90_000, maxBuffer: 32 * 1024 * 1024 });
  return { width, height, lines: [...parseTsv(sparse.stdout, width, height),
    ...parseTsv(block.stdout, width, height)] };
}

async function processLabel(labelId, outputDirectory) {
  const response = await fetch(`https://api.ods.od.nih.gov/dsld/s3/pdf/${labelId}.pdf`,
    { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok || Number(response.headers.get("content-length") ?? 0) > MAX_PDF_BYTES) {
    throw new Error(`PDF unavailable or oversized (${response.status}).`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 8 || bytes.byteLength > MAX_PDF_BYTES
    || Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") {
    throw new Error("Downloaded file is not a valid-sized PDF.");
  }
  const document = await pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true,
    isEvalSupported: false, useSystemFonts: true }).promise;
  const workdir = await mkdtemp(join(tmpdir(), "suppvis-range-panel-"));
  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, MAX_PAGES); pageNumber += 1) {
      pages.push(await ocrPage(document, pageNumber, workdir));
    }
    const pdfSha256 = createHash("sha256").update(bytes).digest("hex");
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(outputDirectory, `${labelId}.json`), JSON.stringify({
      labelId, pdfSha256, ocrVersion: OCR_VERSION, pages,
    }));
    return { labelId, status: "computed-local", pdfSha256,
      pageCount: pages.length, truncated: document.numPages > MAX_PAGES };
  } finally {
    if (typeof document.destroy === "function") await document.destroy();
    await rm(workdir, { recursive: true, force: true });
  }
}

const outputDirectory = argument("--output-dir");
if (!outputDirectory) throw new Error("--output-dir is required.");
const labels = selectedLabels();
if (process.argv.includes("--dry-run")) {
  process.stdout.write(`${JSON.stringify({ mode: "dry-run", labels: labels.length,
    firstLabelId: labels[0], lastLabelId: labels.at(-1), outputDirectory: resolve(outputDirectory) })}\n`);
} else {
  let failures = 0;
  for (const labelId of labels) {
    try {
      process.stdout.write(`${JSON.stringify(await processLabel(labelId, resolve(outputDirectory)))}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`${JSON.stringify({ labelId, status: "failed",
        error: error instanceof Error ? error.message : String(error) })}\n`);
    }
  }
  if (failures) process.exitCode = 1;
}
