import type { LabelOcrPage } from "./group1-label-highlight";

type CachedOcr = { labelId: number; pdfSha256: string; ocrVersion: string; pages: LabelOcrPage[] };
const pending = new Map<number, Promise<CachedOcr | null>>();
const limit = 8;

async function sha256(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A highlight is usable only if its word positions describe the exact PDF shown in the preview. */
export async function labelOcrPages(labelId: number, pdfBytes: Uint8Array): Promise<LabelOcrPage[] | null> {
  let result = pending.get(labelId);
  if (!result) {
    result = fetch(`/api/admin/catalog/group1-review/labels/${labelId}/ocr`,
      { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Cached label OCR unavailable (${response.status})`);
      const value = await response.json() as CachedOcr;
      if (value.labelId !== labelId || !/^[0-9a-f]{64}$/.test(value.pdfSha256)
        || !Array.isArray(value.pages) || value.pages.length > 12 || !value.pages.every((page) =>
          Number.isFinite(page.width) && page.width > 0 && Number.isFinite(page.height) && page.height > 0
          && Array.isArray(page.lines))) throw new Error("Cached label OCR has an invalid shape.");
      return value;
    }).then((value) => {
      // A background job may complete while the admin tab stays open.
      if (!value) pending.delete(labelId);
      return value;
    }).catch((error) => { pending.delete(labelId); throw error; });
    pending.set(labelId, result);
    if (pending.size > limit) pending.delete(pending.keys().next().value!);
  }
  const cache = await result;
  if (!cache) return null;
  return await sha256(pdfBytes) === cache.pdfSha256 ? cache.pages : null;
}
