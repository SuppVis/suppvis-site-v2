import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeLabelText, fallbackRegionScore, findLabelHighlights, labelOcrRegions, placeLabelOcrRegion, spotlightForLabelHighlight, withLabelRowValues } from '../app/admin/catalog/group1-label-highlight.ts';
import { abortable, cachedLabelOcr, createLabelOcrSession } from '../app/admin/catalog/group1-label-ocr.ts';

const word = (text, x, confidence = 95) => ({ text, confidence, box: { x0: x, y0: 100, x1: x + 50, y1: 120 } });
const page = (lines) => ({ width: 1000, height: 500, lines });
assert.equal(normalizeLabelText(' {Total  FÁT}™ '), 'total fat');
let matches = findLabelHighlights(page([[word('Total', 10), word('Fat', 70)]]), '{Total Fat}', 'Total Fat');
assert.equal(matches.length, 1); assert.equal(matches[0].mode, 'source');
assert.deepEqual({ left: matches[0].left, top: matches[0].top, width: matches[0].width, height: matches[0].height },
  { left: 1, top: 20, width: 11, height: 4 }, 'boxes scale with the preview using percentages');
const spot = spotlightForLabelHighlight(matches[0]);
assert.ok(spot.width >= 30 && spot.height >= 52, 'spotlight leaves broad label context');
assert.ok(spot.left <= matches[0].left && spot.top <= matches[0].top);
assert.ok(spot.left + spot.width >= matches[0].left + matches[0].width);
assert.ok(spot.top + spot.height >= matches[0].top + matches[0].height);
const valueWord = (text, x, y = 100) => ({ text, confidence: 94,
  box: { x0: x, y0: y, x1: x + 40, y1: y + 20 } });
const fullRow = page([
  [valueWord('Net', 100), valueWord('Carbohydrates', 145)],
  [valueWord('0', 500), valueWord('g', 544)],
  [valueWord('0%', 800)],
  [valueWord('999', 900, 135)],
]);
const rowMatch = findLabelHighlights(fullRow, 'Net Carbohydrates', 'Net Carbohydrates')[0];
assert.equal(rowMatch.relatedBoxes.length, 2, 'amount/unit and %DV are found across separate OCR lines');
assert.ok(rowMatch.relatedBoxes[0].width > 4, 'the nearby unit joins the amount outline');
const rowSpot = spotlightForLabelHighlight(rowMatch);
assert.ok(rowSpot.left <= rowMatch.left && rowSpot.left + rowSpot.width >= rowMatch.relatedBoxes[1].left + rowMatch.relatedBoxes[1].width,
  'spotlight covers the name and the printed values');
assert.ok(rowMatch.relatedBoxes.every((box) => box.left < 90), 'a numeric word on the next row is excluded');
assert.equal(findLabelHighlights(page([[word('Calories', 20)], [valueWord('50', 700, 135)]]), 'Calories', 'Calories')[0].relatedBoxes.length, 0,
  'do not outline a value when it cannot be aligned to the printed row');
const nameAndAmount = page([[valueWord('Net', 100), valueWord('Carbohydrates', 145), valueWord('0', 500)]]);
const dvFromSeparateCrop = { width: 2000, height: 1000, lines: [[valueWord('0%', 1600, 200)]] };
const differentlyReadAmount = page([[valueWord('5g', 500)]]);
const enriched = withLabelRowValues(findLabelHighlights(nameAndAmount, 'Net Carbohydrates', 'Net Carbohydrates')[0],
  [nameAndAmount, nameAndAmount, differentlyReadAmount, dvFromSeparateCrop]);
assert.equal(enriched.relatedBoxes.length, 2, 'other OCR crops contribute %DV without duplicating even a differently read amount');
assert.ok(spotlightForLabelHighlight(enriched).left + spotlightForLabelHighlight(enriched).width
  >= enriched.relatedBoxes[1].left + enriched.relatedBoxes[1].width);
const edgeSpot = spotlightForLabelHighlight({ ...matches[0], left: 98, top: 97, width: 2, height: 3 });
assert.equal(edgeSpot.left + edgeSpot.width, 100);
assert.equal(edgeSpot.top + edgeSpot.height, 100);
matches = findLabelHighlights(page([[word('Calories', 20)]]), 'kCals', 'Calories');
assert.equal(matches[0].mode, 'suggested', 'fallback wording must never masquerade as the source name');
matches = findLabelHighlights(page([[word('Proteins', 50)], [word('Protein', 60)]]), 'Proteins', 'Protein');
assert.equal(matches[0].mode, 'source', 'actual source spelling wins over the proposed field');
assert.equal(findLabelHighlights(page([[word('Fatty', 20)]]), 'Fat', 'Fat').length, 0, 'no substring matches');
assert.equal(findLabelHighlights(page([[word('Total', 20)], [word('Fat', 40)]]), 'Total Fat', 'Total Fat').length, 0,
  'never combine words across lines/columns');
assert.equal(findLabelHighlights(page([[word('Calories', 20, 20)]]), 'Calories', 'Calories').length, 0);
assert.equal(findLabelHighlights(page([[word('Total', 20, 95), word('Fat', 80, 40)]]), 'Total Fat', 'Total Fat').length, 0);
assert.equal(findLabelHighlights(page([[word('Proteim', 20)]]), 'Protein', 'Protein')[0].mode, 'approximate');
assert.equal(findLabelHighlights(page([[word('Fet', 20)]]), 'Fat', 'Fat').length, 0, 'short words are not fuzzy matched');
assert.equal(findLabelHighlights(page([[word('Calories', NaN)]]), 'Calories', 'Calories').length, 0);
assert.equal(findLabelHighlights(page([[word('Calories', 990)]]), 'Calories', 'Calories').length, 0);
assert.equal(findLabelHighlights(page([[word('Calories', 20)]]), '', '').length, 0);
assert.equal(findLabelHighlights(page(Array.from({ length: 20 }, () => [word('Calories', 20)])), 'Calories', 'Calories').length, 10);
const wideRegions = labelOcrRegions(1000, 300);
assert.equal(wideRegions.length, 5);
assert.deepEqual(wideRegions[4], { left: 650, top: 0, width: 350, height: 300 });
assert.deepEqual(labelOcrRegions(300, 1000)[2], { left: 0, top: 230, width: 300, height: 350 });
const cropped = placeLabelOcrRegion(page([[word('Fat', 20)]]), wideRegions[4], 2, 2000, 600);
assert.equal(cropped.lines[0][0].box.x0, 1320);
assert.equal(findLabelHighlights(cropped, 'Fat', 'Total Fat')[0].left, 66);
assert.ok(fallbackRegionScore(page([[word('Carbohydrates', 20)]]), 'Net Carbohydrates', 'Net Carbohydrates')
  > fallbackRegionScore(page([[word('Unrelated', 20)]]), 'Net Carbohydrates', 'Net Carbohydrates'),
  'a partial name match should prioritize its zoomed region for the fallback');

const tick = () => new Promise((resolve) => setImmediate(resolve));
const canvas = { width: 1000, height: 500 };
let terminated = 0; let recognized = 0; let initialized = 0; const modes = [];
const worker = {
  terminate: async () => { terminated += 1; },
  setParameters: async (parameters) => { modes.push(parameters.tessedit_pageseg_mode); },
  recognize: async () => { recognized += 1; return { data: { blocks: [{ paragraphs: [{ lines: [{ words: [
    { text: 'Calories', confidence: 95, bbox: { x0: 20, y0: 100, x1: 100, y1: 120 } },
  ] }] }] }] } }; },
};
const session = createLabelOcrSession(new AbortController().signal, async () => { initialized += 1; return worker; });
await session.recognize(canvas, 'test:first');
assert.equal(cachedLabelOcr('test:first').lines[0][0].text, 'Calories');
await session.recognize(canvas, 'test:first');
await session.recognize(canvas, 'test:second');
await session.recognize(canvas, 'test:first:block', 'singleBlock');
await session.recognize(canvas, 'test:first:block', 'singleBlock');
assert.equal(initialized, 1); assert.equal(recognized, 3, 'fallback reuses the worker and caches its separate result');
assert.equal(modes.length, 1, 'fallback switches page segmentation mode once');
session.dispose(); session.dispose(); assert.equal(terminated, 1);
await assert.rejects(session.recognize(canvas, 'test:first'), { name: 'AbortError' });

const waiting = new AbortController();
let finishInitialization;
const late = createLabelOcrSession(waiting.signal, () => new Promise((resolve) => { finishInitialization = resolve; }));
const pending = late.recognize(canvas, 'test:cancelled-init');
waiting.abort();
await assert.rejects(pending, { name: 'AbortError' });
finishInitialization(worker); await tick();
assert.equal(terminated, 2, 'cancelled initialization releases its late-arriving worker');
assert.equal(cachedLabelOcr('test:cancelled-init'), undefined);

const during = new AbortController(); let finishRecognition;
const active = createLabelOcrSession(during.signal, async () => ({
  terminate: worker.terminate,
  recognize: () => new Promise((resolve) => { finishRecognition = resolve; }),
}));
const reading = active.recognize(canvas, 'test:cancelled-read'); await tick();
during.abort(); await assert.rejects(reading, { name: 'AbortError' });
finishRecognition({ data: { blocks: [] } }); await tick();
assert.equal(cachedLabelOcr('test:cancelled-read'), undefined, 'stale OCR results must not reappear');
assert.equal(terminated, 3);
await assert.rejects(abortable(Promise.resolve('ignored'), during.signal), { name: 'AbortError' });

const failed = createLabelOcrSession(new AbortController().signal, async () => { throw new Error('Offline'); });
await assert.rejects(failed.recognize(canvas, 'test:failed'), /Offline/); failed.dispose();
assert.equal(cachedLabelOcr('test:failed'), undefined);
const bounded = createLabelOcrSession(new AbortController().signal, async () => worker);
for (let n = 0; n < 17; n += 1) await bounded.recognize(canvas, `test:bounded:${n}`);
assert.equal(cachedLabelOcr('test:bounded:0'), undefined, 'OCR page cache is bounded');
assert.ok(cachedLabelOcr('test:bounded:16')); bounded.dispose();

const ocrSource = readFileSync('app/admin/catalog/group1-label-ocr.ts', 'utf8');
assert.ok(ocrSource.includes('workerBlobURL: false'));
assert.ok(!ocrSource.includes('https://'), 'OCR assets do not use an external service/CDN');
const preview = readFileSync('app/admin/catalog/Group1LabelPreview.tsx', 'utf8');
assert.ok(preview.includes('labelOcrPages(labelId, bytes)'), 'highlighting uses the precomputed PDF-hashed OCR');
assert.ok(!preview.includes('createLabelOcrSession(signal)'), 'browser OCR is no longer run during review');
assert.ok(!preview.includes('Find on label'), 'OCR starts automatically, with no button');
assert.ok(preview.includes('spotlightForLabelHighlight(visibleBox)'), 'located text receives a broad spotlight');
assert.ok(!preview.includes('Possible match ↓'), 'the old orange badge must not obscure the label');
assert.ok(preview.includes('outlineOffset: "7px"'), 'the text outline must sit outside OCR word boxes');
assert.ok(!preview.includes('saveReviewDecision'), 'location hints never save or approve decisions');
console.log('Group 1 OCR highlight tests passed (matching, confidence, coordinates, caching and cancellation).');
