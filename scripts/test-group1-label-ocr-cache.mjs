import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { labelOcrPages } from '../app/admin/catalog/group1-label-ocr-cache.ts';

const originalFetch = globalThis.fetch;
const bytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
const hash = createHash('sha256').update(bytes).digest('hex');
const pages = [{ width: 100, height: 200, lines: [[{
  text: 'Calories', confidence: 94, box: { x0: 1, y0: 2, x1: 20, y1: 12 },
}]] }];
let requests = 0;
globalThis.fetch = async () => {
  requests += 1;
  return Response.json({ labelId: 900001, pdfSha256: hash, ocrVersion: 'test', pages });
};
try {
  assert.deepEqual(await labelOcrPages(900001, bytes), pages);
  assert.equal(await labelOcrPages(900001, new Uint8Array([37, 80, 68, 70, 45, 50])), null,
    'word positions must not be used on a different PDF');
  assert.equal(requests, 1, 'preload and visible preview share the OCR response');
  globalThis.fetch = async () => new Response(null, { status: 404 });
  assert.equal(await labelOcrPages(900002, bytes), null, 'missing cache requires manual inspection');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Group 1 server OCR cache and PDF hash checks passed.');
