import assert from 'node:assert/strict';
import { labelPdfBytes } from '../app/admin/catalog/group1-label-pdf.ts';

const originalFetch = globalThis.fetch;
let requests = 0;
globalThis.fetch = async () => {
  requests += 1;
  return new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 });
};
try {
  const [first, second] = await Promise.all([labelPdfBytes(902001), labelPdfBytes(902001)]);
  assert.equal(requests, 1, 'concurrent preview and preload should share one PDF request');
  assert.deepEqual(first, second);
  await labelPdfBytes(902001);
  assert.equal(requests, 1, 'opening a preloaded label should use its memory cache');
  await labelPdfBytes(902002);
  assert.equal(requests, 2, 'a new label loads from the existing NIH PDF proxy');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Group 1 label PDF prefetch cache tests passed.');
