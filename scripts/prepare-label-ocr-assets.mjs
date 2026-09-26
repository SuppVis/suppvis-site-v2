// Generate same-origin OCR assets from lockfile-pinned npm packages. No CDN fetches.
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const destination = resolve(root, 'public/ocr/tesseract-7-eng-1');
const engineRoot = dirname(require.resolve('tesseract.js/package.json'));
const coreRoot = dirname(require.resolve('tesseract.js-core/package.json'));
const languageRoot = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
const pdfRoot = dirname(require.resolve('pdfjs-dist/package.json'));
await mkdir(destination, { recursive: true });
await copyFile(resolve(engineRoot, 'dist/worker.min.js'), resolve(destination, 'worker.min.js'));
await copyFile(resolve(engineRoot, 'dist/worker.min.js.LICENSE.txt'), resolve(destination, 'worker.LICENSE.txt'));
await copyFile(resolve(coreRoot, 'LICENSE'), resolve(destination, 'core.LICENSE.txt'));
// Include scalar, SIMD and relaxed-SIMD builds, including their separate WASM files.
for (const name of await readdir(coreRoot)) {
  if (/^tesseract-core(?:-[a-z]+)*(?:\.wasm|\.wasm\.js)$/.test(name)) {
    await copyFile(resolve(coreRoot, name), resolve(destination, name));
  }
}
await copyFile(resolve(languageRoot, '4.0.0_best_int/eng.traineddata.gz'), resolve(destination, 'eng.traineddata.gz'));
// Serve the PDF.js module worker as a static ESM asset. Bundling it as a
// webpack-emitted .mjs file makes Next's minifier parse import.meta as a script.
const pdfDestination = resolve(root, 'public/ocr/pdfjs-6');
await mkdir(pdfDestination, { recursive: true });
await copyFile(resolve(pdfRoot, 'build/pdf.worker.min.mjs'), resolve(pdfDestination, 'pdf.worker.min.mjs'));
await writeFile(resolve(destination, 'versions.json'), JSON.stringify({
  tesseract: require('tesseract.js/package.json').version,
  core: require('tesseract.js-core/package.json').version,
  english: require('@tesseract.js-data/eng/package.json').version,
}, null, 2) + '\n');
console.log('Prepared same-origin label OCR assets.');
