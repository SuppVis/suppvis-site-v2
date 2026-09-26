# Automatic label highlighting in Group 1 review

Opening a Group 1 review occurrence starts a browser-local OCR search of the original DSLD label PDF. The feature is a visual aid only; it never classifies a row, changes a review decision, or writes catalog data.

The label remains available for inspection. A confident text location gets a thin outline offset outside the OCR word box, inside a broad spotlight; the rest of the image dims. The outline does not cover the letters, and there is no badge over the image. Exact extracted wording wins; if the printed label instead has the proposed field's wording, the status explicitly says it is a suggested-field match, not the extracted name. Low-confidence matches produce a manual-inspection message, not a fabricated location. Reviewers should still verify every highlighted location against the image.

The browser loads lockfile-pinned PDF.js and English Tesseract assets from the site's own `/ocr/` paths. `npm run prepare:label-ocr` copies these files from installed packages before dev, build, and start. No label image is sent to an external OCR service. The OCR first scans the full page and then overlapping, higher-resolution strips to handle narrow facts panels in wide labels. It searches at most 12 pages, has a 90-second timeout, caches up to 16 page/region results in memory, and cancels stale work when a reviewer switches occurrences.

Verification: `npm run test:group1-label-highlight`, focused lint, TypeScript, admin catalog tests, and `npm run build`. In the local review page, DSLD label 2464 under "Cholesterols" highlighted the printed "Cholesterol" within the Supplement Facts area and labeled it as suggested-field wording. DSLD label 31554 under "{Total Fat}" did not produce a confident match and correctly fell back to manual inspection. OCR coverage is intentionally not expected to be 100%.

This feature has been tested only in the isolated local admin review setup. It has not been deployed, and no production registry or catalog data was changed.
