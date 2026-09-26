/** Location hints only: these functions never classify a row or alter review data. */
export type LabelWord = { text: string; confidence: number; box: { x0: number; y0: number; x1: number; y1: number } };
export type LabelOcrPage = { width: number; height: number; lines: LabelWord[][] };
export type LabelHighlight = {
  text: string;
  mode: "source" | "suggested" | "approximate";
  left: number; top: number; width: number; height: number;
};

export type LabelOcrRegion = { left: number; top: number; width: number; height: number };

/** Whole-page first, then overlapping high-resolution strips on the long axis. */
export function labelOcrRegions(width: number, height: number): LabelOcrRegion[] {
  if (!(width > 0 && height > 0)) return [];
  const regions = [{ left: 0, top: 0, width, height }];
  for (const start of [0, 0.23, 0.46, 0.65]) {
    regions.push(width >= height
      ? { left: width * start, top: 0, width: width * 0.35, height }
      : { left: 0, top: height * start, width, height: height * 0.35 });
  }
  return regions;
}

/** OCR coordinates from a cropped PDF viewport, expressed on the original page. */
export function placeLabelOcrRegion(page: LabelOcrPage, region: LabelOcrRegion, scale: number,
  fullWidth: number, fullHeight: number): LabelOcrPage {
  const dx = region.left * scale; const dy = region.top * scale;
  return { width: fullWidth, height: fullHeight,
    lines: page.lines.map((line) => line.map((word) => ({ ...word, box: {
      x0: word.box.x0 + dx, x1: word.box.x1 + dx,
      y0: word.box.y0 + dy, y1: word.box.y1 + dy,
    } }))) };
}

export function normalizeLabelText(text: string): string {
  return text.replace(/[™®]/g, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function oneEditApart(left: string, right: string): boolean {
  if (left === right) return true;
  if (Math.min(left.length, right.length) < 6 || Math.abs(left.length - right.length) > 1) return false;
  let a = 0; let b = 0; let edits = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) { a += 1; b += 1; continue; }
    if (++edits > 1) return false;
    if (left.length >= right.length) a += 1;
    if (right.length >= left.length) b += 1;
  }
  return edits + (left.length - a) + (right.length - b) <= 1;
}

export function findLabelHighlights(page: LabelOcrPage, sourceName: string, suggestedField: string): LabelHighlight[] {
  if (!(page.width > 0 && page.height > 0)) return [];
  const queries: Array<{ words: string[]; mode: LabelHighlight["mode"]; fuzzy: boolean }> = [];
  const source = normalizeLabelText(sourceName);
  const suggested = normalizeLabelText(suggestedField);
  if (source) queries.push({ words: source.split(" "), mode: "source", fuzzy: false });
  if (suggested && source !== suggested) queries.push({ words: suggested.split(" "), mode: "suggested", fuzzy: false });
  if (source) queries.push({ words: source.split(" "), mode: "approximate", fuzzy: true });

  for (const query of queries) {
    const found: LabelHighlight[] = [];
    for (const line of page.lines) {
      const words = line.flatMap((word) => normalizeLabelText(word.text).split(" ").filter(Boolean)
        .map((text) => ({ ...word, text })));
      for (let start = 0; start <= words.length - query.words.length; start += 1) {
        const span = words.slice(start, start + query.words.length);
        if (!span.every((word, index) => Number.isFinite(word.confidence) && word.confidence >= 40
          && (query.fuzzy ? oneEditApart(word.text, query.words[index]) : word.text === query.words[index]))) continue;
        if (span.reduce((sum, word) => sum + word.confidence, 0) / span.length < 70) continue;
        const x0 = Math.min(...span.map((word) => word.box.x0));
        const y0 = Math.min(...span.map((word) => word.box.y0));
        const x1 = Math.max(...span.map((word) => word.box.x1));
        const y1 = Math.max(...span.map((word) => word.box.y1));
        if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0
          || x0 < 0 || y0 < 0 || x1 > page.width || y1 > page.height) continue;
        found.push({ text: span.map((word) => word.text).join(" "), mode: query.mode,
          left: x0 / page.width * 100, top: y0 / page.height * 100,
          width: (x1 - x0) / page.width * 100, height: (y1 - y0) / page.height * 100 });
      }
    }
    // Never combine unrelated words across lines/columns or flood the page with boxes.
    if (found.length) return found.slice(0, 10);
  }
  return [];
}
