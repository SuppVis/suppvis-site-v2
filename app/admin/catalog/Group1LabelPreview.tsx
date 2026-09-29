"use client";

import { useEffect, useRef, useState } from "react";
import { findLabelHighlights, labelOcrRegions, placeLabelOcrRegion, spotlightForLabelHighlight, type LabelHighlight } from "./group1-label-highlight";
import { abortable, cachedLabelOcr, createLabelOcrSession } from "./group1-label-ocr";
import { labelPdfBytes } from "./group1-label-pdf";
import { LABEL_ZOOM_LEVELS, labelRenderGeometry } from "./group1-label-render";

type PdfDocument = import("pdfjs-dist").PDFDocumentProxy;

export function Group1LabelPreview({ labelId, sourceName, suggestedFieldName, prefetchOnly = false, onScanSettled }: {
  labelId: number; sourceName: string; suggestedFieldName: string;
  prefetchOnly?: boolean; onScanSettled?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const activeRenderRef = useRef<ReturnType<import("pdfjs-dist").PDFPageProxy["render"]> | null>(null);
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewWidth, setViewWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [hint, setHint] = useState("Finding text on the label automatically…");
  const [highlightedPage, setHighlightedPage] = useState<{ page: number; boxes: LabelHighlight[] } | null>(null);
  const firstHighlightRef = useRef<HTMLSpanElement>(null);
  const manuallyChangedPage = useRef(false);
  const onScanSettledRef = useRef(onScanSettled);
  onScanSettledRef.current = onScanSettled;

  useEffect(() => {
    if (prefetchOnly) return;
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => setViewWidth(container.clientWidth));
    observer.observe(container);
    setViewWidth(container.clientWidth);
    return () => observer.disconnect();
  }, [prefetchOnly]);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

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
      const bytes = await labelPdfBytes(labelId);
      if (cancelled) return;
      // pdf.js transfers the supplied buffer to its worker. Preserve the cached copy.
      loadingTask = pdfjs.getDocument({ data: bytes.slice() });
      const loaded = await loadingTask.promise;
      if (cancelled) return;
      setDocument(loaded);
      setPageCount(loaded.numPages);
    }).catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
        setHint("Automatic highlighting is unavailable because the label could not be loaded.");
        onScanSettledRef.current?.();
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
        setHint(`Spotlighted ${best.boxes.length > 1 ? `one of ${best.boxes.length} possible locations` : "a possible location"} for “${best.boxes[0].text}” (${qualifier}). Verify it against the label; this is not an approval.${document.numPages > pageLimit ? " Only the first 12 pages were searched." : ""}`);
      } else {
        setHint(`Couldn’t confidently locate this text. Please inspect the label manually.${document.numPages > pageLimit ? " Only the first 12 pages were searched." : ""}`);
      }
    })().catch(() => {
      if (!signal.aborted || timedOut) {
        setHint(timedOut ? "Automatic text search timed out. Please inspect the label manually."
          : "Automatic highlighting is unavailable for this label. You can still review the image.");
      }
    }).finally(() => {
      window.clearTimeout(timeout);
      session.dispose();
      if (!signal.aborted) onScanSettledRef.current?.();
    });
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      renderTask?.cancel();
      session.dispose();
    };
  }, [document, labelId, sourceName, suggestedFieldName]);

  useEffect(() => {
    if (!document || prefetchOnly || !viewWidth) return;
    let cancelled = false;
    let renderTask: ReturnType<import("pdfjs-dist").PDFPageProxy["render"]> | null = null;
    setLoading(true);
    setError(false);
    void (async () => {
      // pdf.js cannot render onto a canvas until the previous task has stopped.
      const previous = activeRenderRef.current;
      if (previous) {
        previous.cancel();
        await previous.promise.catch(() => undefined);
      }
      if (cancelled) return;
      const page = await document.getPage(pageNumber);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const pageElement = pageRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context || !pageElement) throw new Error("Label canvas is unavailable");
      const base = page.getViewport({ scale: 1 });
      const geometry = labelRenderGeometry(base.width, base.height, viewWidth, LABEL_ZOOM_LEVELS[zoomIndex], window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: geometry.scale });
      canvas.width = geometry.bitmapWidth;
      canvas.height = geometry.bitmapHeight;
      canvas.style.width = `${geometry.width}px`;
      canvas.style.height = `${geometry.height}px`;
      pageElement.style.width = `${geometry.width}px`;
      pageElement.style.height = `${geometry.height}px`;
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: [geometry.outputScale, 0, 0, geometry.outputScale, 0, 0],
      });
      activeRenderRef.current = renderTask;
      await renderTask.promise;
      if (!cancelled) setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    }).finally(() => {
      if (activeRenderRef.current === renderTask) activeRenderRef.current = null;
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, prefetchOnly, viewWidth, zoomIndex]);

  useEffect(() => {
    if (loading || highlightedPage?.page !== pageNumber) return;
    const container = containerRef.current;
    const marker = firstHighlightRef.current;
    if (container && marker) {
      container.scrollTop = Math.max(0, marker.offsetTop - 120);
      container.scrollLeft = Math.max(0, marker.offsetLeft - container.clientWidth / 2);
    }
  }, [loading, highlightedPage, pageNumber, zoomIndex, viewWidth]);

  const visibleBox = highlightedPage?.page === pageNumber ? highlightedPage.boxes[0] : undefined;
  const spotlight = visibleBox ? spotlightForLabelHighlight(visibleBox) : null;

  if (prefetchOnly) return null;

  return (
    <div className={expanded
      ? "fixed inset-2 z-[100] flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white text-slate-800 shadow-2xl md:inset-5"
      : "rounded border border-white/15 bg-white text-slate-800"}>
      <p role="status" className="border-b border-slate-200 bg-amber-50 px-3 py-2 text-left text-xs text-slate-700">{hint}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-200 bg-slate-100 p-2 text-sm">
        {pageCount > 1 ? <>
          <button type="button" disabled={pageNumber === 1} onClick={() => { manuallyChangedPage.current = true; setPageNumber(pageNumber - 1); }}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Previous</button>
          <span>Page {pageNumber} of {pageCount}</span>
          <button type="button" disabled={pageNumber === pageCount} onClick={() => { manuallyChangedPage.current = true; setPageNumber(pageNumber + 1); }}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
        </> : null}
        <button type="button" aria-label="Zoom out" disabled={zoomIndex === 0} onClick={() => setZoomIndex((index) => index - 1)}
          className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40">−</button>
        <button type="button" onClick={() => setZoomIndex(0)}
          className="min-w-28 rounded border border-slate-300 px-2 py-1">{Math.round(LABEL_ZOOM_LEVELS[zoomIndex] * 100)}% · {zoomIndex ? "Reset" : "Fit"}</button>
        <button type="button" aria-label="Zoom in" disabled={zoomIndex === LABEL_ZOOM_LEVELS.length - 1} onClick={() => setZoomIndex((index) => index + 1)}
          className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40">+</button>
        <button type="button" onClick={() => setExpanded((value) => !value)}
          className="rounded border border-slate-300 px-2 py-1">{expanded ? "Close expanded view" : "Expand label"}</button>
      </div>
      <div ref={containerRef} className={expanded
        ? "relative min-h-0 flex-1 overflow-auto text-center"
        : "relative max-h-[520px] min-h-[420px] overflow-auto text-center"}>
        {loading ? <p className="p-6 text-sm">Loading label image…</p> : null}
        {error ? <p className="p-6 text-sm">Preview unavailable. Use “Open label PDF” above.</p> : null}
        <div ref={pageRef} className={`relative mx-auto ${loading || error ? "hidden" : "block"}`}>
          <canvas ref={canvasRef} aria-label={`DSLD label ${labelId}, page ${pageNumber}`} className="block" />
          {spotlight ? <span aria-hidden="true" className="pointer-events-none absolute z-10 rounded-md border border-white/85"
            style={{ left: `${spotlight.left}%`, top: `${spotlight.top}%`, width: `${spotlight.width}%`, height: `${spotlight.height}%`,
              boxShadow: "0 0 0 9999px rgba(7, 12, 20, 0.68)" }} /> : null}
          {visibleBox ? <span ref={firstHighlightRef} role="img" aria-label={`Possible text location: ${visibleBox.text}`}
            className="pointer-events-none absolute z-20 rounded-sm"
            style={{ left: `${visibleBox.left}%`, top: `${visibleBox.top}%`, width: `${visibleBox.width}%`, height: `${visibleBox.height}%`,
              outline: "2px solid #f59e0b", outlineOffset: "7px" }} /> : null}
        </div>
      </div>
    </div>
  );
}
