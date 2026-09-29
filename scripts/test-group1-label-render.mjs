import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LABEL_ZOOM_LEVELS, labelRenderGeometry } from '../app/admin/catalog/group1-label-render.ts';

assert.deepEqual(LABEL_ZOOM_LEVELS, [1, 1.5, 2, 3, 4]);
const fit = labelRenderGeometry(600, 800, 602, 1, 2);
const enlarged = labelRenderGeometry(600, 800, 602, 2, 2);
assert.equal(fit.width, 600);
assert.equal(enlarged.width, 1200);
assert.equal(enlarged.bitmapWidth, 2400, 'zoom rerenders the PDF at full display density');
assert.equal(enlarged.bitmapHeight, 3200);
const huge = labelRenderGeometry(600, 800, 1400, 4, 3);
assert.ok(huge.bitmapWidth * huge.bitmapHeight <= 24_000_000, 'large pages stay within the canvas budget');
assert.ok(Math.max(huge.bitmapWidth, huge.bitmapHeight) <= 8192);

const preview = readFileSync('app/admin/catalog/Group1LabelPreview.tsx', 'utf8');
assert.ok(preview.includes('labelRenderGeometry('));
assert.ok(preview.includes('ResizeObserver('), 'expanded previews rerender at their new width');
assert.ok(preview.includes('canvas.style.width = `${geometry.width}px`'), 'the visible page uses its true zoomed width');
assert.ok(preview.includes('pageElement.style.width = `${geometry.width}px`'), 'highlight percentages track the zoomed page');
assert.ok(preview.includes('activeRenderRef.current'), 'successive renders do not compete for the same canvas');
console.log('Group 1 PDF zoom geometry tests passed.');
