"use client";

import { useEffect, useRef, useState } from "react";
import { findLabelHighlights, labelOcrRegions, placeLabelOcrRegion, type LabelHighlight } from "./group1-label-highlight";
import { abortable, cachedLabelOcr, createLabelOcrSession } from "./group1-label-ocr";

type PdfDocument = import("pdfjs-dist").PDFDocumentProxy;

export function Group1LabelPreview({ labelId, sourceName, suggestedFieldName }: {
  labelId: number; sourceName: string; suggestedFieldName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hint, setHint] = useState("Finding text on the label automatically…");
  const [highlightedPage, setHighlightedPage] = useState<{ page: number; boxes: LabelHighlight[] } | null>(null);
  const firstHighlightRef = useRef<HTMLSpanElement>(null);
  const manuallyChangedPage = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof import("pdfjs-dist").getDocument> | null = null;
    setDocument(null);
    setPageNumber(1);
    setPageCount(0);
    setError(false);
    setLoading(true);
    void import("pdfjs-dist").then(async (pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/ocr/pdfjs-6/pdf.worker.min.mjs";
      loadingTask = pdfjs.getDocument({ url: `/api/admin/group1-label/${labelId}` });
      const loaded = await loadingTask.promise;
      if (cancelled) return;
      setDocument(loaded);
      setPageCount(loaded.numPages);
    }).catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
        setHint("Automatic highlighting is unavailable because the label could not be loaded.");
      }
    });
    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [labelId]);

  useEffect(() => {
    if (!document) return;
    const controller = new AbortController();
    const { signal } = controller;
    const session = createLabelOcrSession(signal);
    let renderTask: ReturnType<import("pdfjs-dist").PDFPageProxy["render"]> | null = null;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 90_000);
    manuallyChangedPage.current = false;
    setHighlightedPage(null);
    setHint("Finding text on the label automatically…");
    void (async () => {
      let best: { page: number; boxes: LabelHighlight[] } | null = null;
      const pageLimit = Math.min(document.numPages, 12);
      for (let number = 1; number <= pageLimit; number += 1) {
        const page = await abortable(document.getPage(number), signal);
        const base = page.getViewport({ scale: 1 });
        const regions = labelOcrRegions(base.width, base.height);
        for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
          const region = regions[regionIndex];
          setHint(`Finding text on the label automatically… page ${number} of ${document.numPages}${regionIndex ? ", detail scan" : ""}`);
          const cacheKey = `${labelId}:${number}:${regionIndex}:ocr-v2`;
          let raw = cachedLabelOcr(cacheKey);
          const maxEdge = regionIndex ? 2000 : 2800;
          const maxPixels = regionIndex ? 3_500_000 : 6_000_000;
          const scale = Math.min(maxEdge / Math.max(region.width, region.height),
            Math.sqrt(maxPixels / (region.width * region.height)));
          if (!raw) {
            const viewport = page.getViewport({ scale, offsetX: -region.left * scale, offsetY: -region.top * scale });
            const image = window.document.createElement("canvas");
            image.width = Math.ceil(region.width * scale); image.height = Math.ceil(region.height * scale);
            const context = image.getContext("2d");
            if (!context) throw new Error("OCR canvas unavailable");
            try {
              renderTask = page.render({ canvas: image, canvasContext: context, viewport });
              await abortable(renderTask.promise, signal);
              raw = await session.recognize(image, cacheKey);
            } finally {
              image.width = 0; image.height = 0;
            }
          }
          if (signal.aborted) return;
          const result = placeLabelOcrRegion(raw, region, scale, base.width * scale, base.height * scale);
          const boxes = findLabelHighlights(result, sourceName, suggestedFieldName);
          const priority = { source: 3, suggested: 2, approximate: 1 };
          if (boxes.length && (!best || priority[boxes[0].mode] > priority[best.boxes[0].mode])) {
            best = { page: number, boxes };
          }
          // A source match is stronger than any hint based on the proposed field.
          if (best?.boxes[0].mode === "source") break;
        }
        if (best?.boxes[0].mode === "source") break;
      }
      if (signal.aborted) return;
      if (best) {
        setHighlightedPage(best);
        if (!manuallyChangedPage.current) setPageNumber(best.page);
        const qualifier = best.boxes[0].mode === "source" ? "extracted wording"
          : best.boxes[0].mode === "suggested" ? "suggested-field wording, not the extracted name"
            : "approximate wording";
        setHint(`Highlighted ${best.boxes.length > 1 ? `${best.boxes.length} possible locations` : "a possible location"} for “${best.boxes[0].text}” (${qualifier}). Verify it against the label; this is not an approval.${document.numPages > pageLimit ? " Only the first 12 pages were searched." : ""}`);
      } else {
        setHint(`Couldn’t confidently locate this text. Please inspect the label manually.${document.numPages > pageLimit ? " Only the first 12 pages were searched." : ""}`);
      }
    })().catch(() => {
      if (!signal.aborted || timedOut) {
        setHint(timedOut ? "Automatic text search timed out. Please inspect the label manually."
          : "Automatic highlighting is unavailable for this label. You can still review the image.");
      }
    }).finally(() => { window.clearTimeout(timeout); session.dispose(); });
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      renderTask?.cancel();
      session.dispose();
    };
  }, [document, labelId, sourceName, suggestedFieldName]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let renderTask: ReturnType<import("pdfjs-dist").PDFPageProxy["render"]> | null = null;
    setLoading(true);
    setError(false);
    void (async () => {
      const page = await document.getPage(pageNumber);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context || !container) throw new Error("Label canvas is unavailable");
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.max(1, container.clientWidth - 2) / base.width });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: [outputScale, 0, 0, outputScale, 0, 0],
      });
      await renderTask.promise;
      if (!cancelled) setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber]);

  useEffect(() => {
    if (loading || highlightedPage?.page !== pageNumber) return;
    const container = containerRef.current;
    const marker = firstHighlightRef.current;
    if (container && marker) container.scrollTop = Math.max(0, marker.offsetTop - 120);
  }, [loading, highlightedPage, pageNumber]);

  const visibleBoxes = highlightedPage?.page === pageNumber ? highlightedPage.boxes : [];

  return (
    <div className="rounded border border-white/15 bg-white text-slate-800">
      <p role="status" className="border-b border-slate-200 bg-amber-50 px-3 py-2 text-left text-xs text-slate-700">{hint}</p>
      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-3 border-b border-slate-200 bg-slate-100 p-2 text-sm">
          <button type="button" disabled={pageNumber === 1} onClick={() => { manuallyChangedPage.current = true; setPageNumber(pageNumber - 1); }}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Previous</button>
          <span>Page {pageNumber} of {pageCount}</span>
          <button type="button" disabled={pageNumber === pageCount} onClick={() => { manuallyChangedPage.current = true; setPageNumber(pageNumber + 1); }}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      ) : null}
      <div ref={containerRef} className="relative max-h-[520px] min-h-[420px] overflow-auto text-center">
        {loading ? <p className="p-6 text-sm">Loading label image…</p> : null}
        {error ? <p className="p-6 text-sm">Preview unavailable. Use “Open label PDF” above.</p> : null}
        <div className={`relative w-full ${loading || error ? "hidden" : "block"}`}>
          <canvas ref={canvasRef} aria-label={`DSLD label ${labelId}, page ${pageNumber}`} className="block" />
          {visibleBoxes.map((box, index) => (
            <span key={`${box.left}:${box.top}:${index}`} ref={index === 0 ? firstHighlightRef : undefined}
              role="img" aria-label={`Possible text location: ${box.text}`}
              className="pointer-events-none absolute rounded-sm border-2 border-orange-500 bg-yellow-300/45 ring-2 ring-orange-300"
              style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}>
              {index === 0 ? <span className="absolute bottom-full left-0 whitespace-nowrap rounded-t bg-orange-500 px-1 py-0.5 text-[10px] font-bold text-white shadow">Possible match ↓</span> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
