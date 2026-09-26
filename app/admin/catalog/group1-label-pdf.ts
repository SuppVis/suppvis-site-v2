const pdfBytes = new Map<number, Promise<Uint8Array>>();
const cacheLimit = 4;

/** Share authenticated label bytes between a hidden OCR preload and the visible preview. */
export async function labelPdfBytes(labelId: number): Promise<Uint8Array> {
  let pending = pdfBytes.get(labelId);
  if (!pending) {
    pending = fetch(`/api/admin/group1-label/${labelId}`, { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Label PDF unavailable (${response.status})`);
        return new Uint8Array(await response.arrayBuffer());
      }).catch((error) => {
        pdfBytes.delete(labelId);
        throw error;
      });
    pdfBytes.set(labelId, pending);
    if (pdfBytes.size > cacheLimit) pdfBytes.delete(pdfBytes.keys().next().value!);
  } else {
    pdfBytes.delete(labelId);
    pdfBytes.set(labelId, pending);
  }
  return pending;
}
