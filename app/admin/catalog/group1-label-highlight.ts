/** Location hints only: these functions never classify a row or alter review data. */
export type LabelWord = { text: string; confidence: number; box: { x0: number; y0: number; x1: number; y1: number } };
export type LabelOcrPage = { width: number; height: number; lines: LabelWord[][] };
export type LabelPercentBox = { left: number; top: number; width: number; height: number };
export type LabelHighlight = {
  text: string;
  mode: "source" | "suggested" | "approximate";
  left: number; top: number; width: number; height: number;
  /** Numeric amount/unit and %DV found on the same printed row, if OCR can align them. */
  relatedBoxes?: LabelPercentBox[];
};

/** Give a matched phrase substantial surrounding label context, even at page edges. */
export function spotlightForLabelHighlight(box: LabelHighlight) {
  const boxes = [box, ...(box.relatedBoxes ?? [])];
  const x0 = Math.min(...boxes.map((value) => value.left));
  const y0 = Math.min(...boxes.map((value) => value.top));
  const x1 = Math.max(...boxes.map((value) => value.left + value.width));
  const y1 = Math.max(...boxes.map((value) => value.top + value.height));
  const width = Math.min(100, Math.max(30, x1 - x0 + 24));
  const height = Math.min(100, Math.max(52, y1 - y0 + 32));
  const left = Math.max(0, Math.min(100 - width, (x0 + x1 - width) / 2));
  const top = Math.max(0, Math.min(100 - height, (y0 + y1 - height) / 2));
  return { left, top, width, height };
}

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

/** Prefer zoomed regions containing part of the requested name or facts-panel context. */
export function fallbackRegionScore(page: LabelOcrPage, sourceName: string, suggestedField: string): number {
  const wanted = new Set(`${normalizeLabelText(sourceName)} ${normalizeLabelText(suggestedField)}`
    .split(" ").filter((word) => word.length >= 3));
  const words = page.lines.flatMap((line) => line.filter((word) => word.confidence >= 40)
    .flatMap((word) => normalizeLabelText(word.text).split(" ").filter(Boolean)));
  const partialMatches = words.filter((word) => wanted.has(word)).length;
  const panelHints = words.filter((word) => ["serving", "calories", "carbohydrates", "sugars", "fiber", "protein"].includes(word)).length;
  return partialMatches * 100 + Math.min(panelHints, 20);
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

function validWord(word: LabelWord, page: LabelOcrPage): boolean {
  const { x0, x1, y0, y1 } = word.box;
  return word.confidence >= 40 && [x0, x1, y0, y1].every(Number.isFinite)
    && x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0 && x1 <= page.width && y1 <= page.height;
}

function sameRowValueBoxes(page: LabelOcrPage, name: LabelWord["box"]): LabelPercentBox[] {
  const rowHeight = name.y1 - name.y0;
  const sameRow = page.lines.flat().filter((word) => validWord(word, page)
    && word.box.x0 >= name.x1 - rowHeight * 0.25
    && Math.min(word.box.y1, name.y1) - Math.max(word.box.y0, name.y0)
      >= Math.min(rowHeight, word.box.y1 - word.box.y0) * 0.5)
    .sort((a, b) => a.box.x0 - b.box.x0);
  const isNumber = (text: string) => {
    // On small facts-panel type, Tesseract sometimes reads a printed zero as O
    // (for example "0 g" becomes "Og"). Only correct it before a known unit.
    const amount = text.trim().replace(/^o(?=\s*(?:mg|g|mcg|µg|ug|iu|kcal|cal|%))/i, "0");
    return /\d/.test(amount) && /^[<>≈~≤≥]?\s*[\d.,]+(?:\s*(?:mg|g|mcg|µg|ug|iu|kcal|cal|%))?[%*]?$/i.test(amount);
  };
  const isUnit = (text: string) => /^(?:mg|g|mcg|µg|ug|iu|kcal|cal|%)$/i.test(text.trim());
  const numeric: LabelWord[] = [];
  for (const word of sameRow.filter((item) => isNumber(item.text))) {
    const centerX = (word.box.x0 + word.box.x1) / 2;
    const centerY = (word.box.y0 + word.box.y1) / 2;
    // Overlapping crops may read the same printed value differently ("5g" vs "59").
    // Deduplicate by position, not OCR text, before selecting amount and %DV.
    if (numeric.some((previous) => Math.abs((previous.box.x0 + previous.box.x1) / 2 - centerX) < rowHeight * 0.6
      && Math.abs((previous.box.y0 + previous.box.y1) / 2 - centerY) < rowHeight * 0.6)) continue;
    numeric.push(word);
    if (numeric.length === 3) break;
  }
  return numeric.map((word) => {
    const next = sameRow.find((candidate) => candidate.box.x0 >= word.box.x1
      && candidate.box.x0 - word.box.x1 <= rowHeight * 1.5 && isUnit(candidate.text));
    const x1 = Math.max(word.box.x1, next?.box.x1 ?? word.box.x1);
    const y0 = Math.min(word.box.y0, next?.box.y0 ?? word.box.y0);
    const y1 = Math.max(word.box.y1, next?.box.y1 ?? word.box.y1);
    return { left: word.box.x0 / page.width * 100, top: y0 / page.height * 100,
      width: (x1 - word.box.x0) / page.width * 100, height: (y1 - y0) / page.height * 100 };
  });
}

/** Combine already-scanned OCR crops so values outside the name crop can join its row. */
export function withLabelRowValues(highlight: LabelHighlight, scans: LabelOcrPage[]): LabelHighlight {
  if (!scans.length) return highlight;
  const page: LabelOcrPage = { width: 100, height: 100,
    lines: scans.flatMap((scan) => scan.lines.map((line) => line.map((word) => ({
      ...word,
      box: { x0: word.box.x0 / scan.width * 100, x1: word.box.x1 / scan.width * 100,
        y0: word.box.y0 / scan.height * 100, y1: word.box.y1 / scan.height * 100 },
    })))) };
  return { ...highlight, relatedBoxes: sameRowValueBoxes(page, {
    x0: highlight.left, y0: highlight.top,
    x1: highlight.left + highlight.width, y1: highlight.top + highlight.height,
  }) };
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
          width: (x1 - x0) / page.width * 100, height: (y1 - y0) / page.height * 100,
          relatedBoxes: sameRowValueBoxes(page, { x0, y0, x1, y1 }) });
      }
    }
    // Never combine unrelated words across lines/columns or flood the page with boxes.
    if (found.length) return found.slice(0, 10);
  }
  return [];
}
