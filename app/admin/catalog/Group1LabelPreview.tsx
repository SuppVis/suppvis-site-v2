"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findLabelHighlights, spotlightForLabelHighlight, withLabelRowValues, type LabelHighlight } from "./group1-label-highlight";
import { labelOcrPages } from "./group1-label-ocr-cache";
import { labelPdfBytes } from "./group1-label-pdf";
import { MAX_LABEL_ZOOM, MIN_LABEL_ZOOM, clampLabelZoom, labelRenderGeometry, labelSpotlightScroll, labelZoomForSpotlight, nextLabelZoom } from "./group1-label-render";

type PdfDocument = import("pdfjs-dist").PDFDocumentProxy;
type ZoomAnchor = { pageX: number; pageY: number; viewportX: number; viewportY: number };

export function Group1LabelPreview({ labelId, sourceName, suggestedFieldName, prefetchOnly = false, onScanSettled }: {
  labelId: number; sourceName: string; suggestedFieldName: string;
  prefetchOnly?: boolean; onScanSettled?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const activeRenderRef = useRef<ReturnType<import("pdfjs-dist").PDFPageProxy["render"]> | null>(null);
  const renderedPageRef = useRef<{ document: PdfDocument; page: number } | null>(null);
  const renderedZoomRef = useRef(1);
  const pendingAnchorRef = useRef<ZoomAnchor | null>(null);
  const autoFocusPendingRef = useRef(false);
  const manuallyAdjustedViewRef = useRef(false);
  const zoomRef = useRef(1);
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [renderRevision, setRenderRevision] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [hint, setHint] = useState("Finding text on the label automatically…");
  const [highlightedPage, setHighlightedPage] = useState<{ page: number; boxes: LabelHighlight[] } | null>(null);
  const firstHighlightRef = useRef<HTMLSpanElement>(null);
  const manuallyChangedPage = useRef(false);
  const onScanSettledRef = useRef(onScanSettled);
  onScanSettledRef.current = onScanSettled;
  zoomRef.current = zoom;

  const setZoomAt = useCallback((nextZoom: number, clientX: number, clientY: number) => {
    manuallyAdjustedViewRef.current = true;
    autoFocusPendingRef.current = false;
    const next = clampLabelZoom(nextZoom);
    if (Math.abs(next - zoomRef.current) < 0.002) return;
    const container = containerRef.current;
    const page = pageRef.current;
    if (container && page) {
      const viewport = container.getBoundingClientRect();
      const bounds = page.getBoundingClientRect();
      if (bounds.width && bounds.height) {
        pendingAnchorRef.current = {
          pageX: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
          pageY: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)),
          viewportX: clientX - viewport.left,
          viewportY: clientY - viewport.top,
        };
      }
    }
    zoomRef.current = next;
    setZoom(next);
  }, []);

  const zoomFromCenter = (nextZoom: number) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (bounds) setZoomAt(nextZoom, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  };

  useEffect(() => {
    if (prefetchOnly) return;
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setViewSize((current) => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      return current.width === width && current.height === height ? current : { width, height };
    });
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    measure();
    return () => observer.disconnect();
  }, [prefetchOnly]);

  useEffect(() => {
    if (prefetchOnly) return;
    const container = containerRef.current;
    if (!container) return;
    let gestureScale = 1;
    let touchDistance = 0;
    const zoomBy = (factor: number, x: number, y: number) => {
      if (Number.isFinite(factor) && factor > 0) setZoomAt(zoomRef.current * factor, x, y);
    };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return; // Trackpad pinch; ordinary wheel scrolling remains unchanged.
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1);
      zoomBy(Math.exp(-delta / 180), event.clientX, event.clientY);
    };
    const distance = (touches: TouchList) => Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) touchDistance = distance(event.touches);
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      const current = distance(event.touches);
      if (touchDistance > 0) zoomBy(current / touchDistance,
        (event.touches[0].clientX + event.touches[1].clientX) / 2,
        (event.touches[0].clientY + event.touches[1].clientY) / 2);
      touchDistance = current;
    };
    const touchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) touchDistance = 0;
    };
    type SafariGesture = Event & { scale: number; clientX: number; clientY: number };
    const gestureStart = (event: Event) => { event.preventDefault(); gestureScale = 1; };
    const gestureChange = (event: Event) => {
      event.preventDefault();
      if (touchDistance) return; // Touch events already handle touchscreens.
      const gesture = event as SafariGesture;
      if (gestureScale > 0) zoomBy(gesture.scale / gestureScale, gesture.clientX, gesture.clientY);
      gestureScale = gesture.scale;
    };
    container.addEventListener("wheel", wheel, { passive: false });
    container.addEventListener("touchstart", touchStart, { passive: true });
    container.addEventListener("touchmove", touchMove, { passive: false });
    container.addEventListener("touchend", touchEnd);
    container.addEventListener("gesturestart", gestureStart, { passive: false });
    container.addEventListener("gesturechange", gestureChange, { passive: false });
    return () => {
      container.removeEventListener("wheel", wheel);
      container.removeEventListener("touchstart", touchStart);
      container.removeEventListener("touchmove", touchMove);
      container.removeEventListener("touchend", touchEnd);
      container.removeEventListener("gesturestart", gestureStart);
      container.removeEventListener("gesturechange", gestureChange);
    };
  }, [prefetchOnly, setZoomAt]);

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
    let cancelled = false;
    manuallyChangedPage.current = false;
    manuallyAdjustedViewRef.current = false;
    autoFocusPendingRef.current = false;
    setHighlightedPage(null);
    setHint("Loading saved text positions…");
    void (async () => {
      const bytes = await labelPdfBytes(labelId);
      const pages = await labelOcrPages(labelId, bytes);
      if (cancelled) return;
      if (!pages) {
        setHint("No saved text positions match this PDF yet. Please inspect the label manually.");
        return;
      }
      let best: { page: number; boxes: LabelHighlight[] } | null = null;
      const priority = { source: 3, suggested: 2, approximate: 1 };
      for (let index = 0; index < pages.length; index += 1) {
        const boxes = findLabelHighlights(pages[index], sourceName, suggestedFieldName);
        if (boxes.length && (!best || priority[boxes[0].mode] > priority[best.boxes[0].mode])) {
          best = { page: index + 1, boxes };
        }
        if (best?.boxes[0].mode === "source") break;
      }
      if (!best) {
        setHint("Couldn’t confidently locate this text in the saved scan. Please inspect the label manually.");
        return;
      }
      const outlined = withLabelRowValues(best.boxes[0], [pages[best.page - 1]]);
      best = { ...best, boxes: [outlined, ...best.boxes.slice(1)] };
      const spotlight = spotlightForLabelHighlight(outlined);
      if (!prefetchOnly && !manuallyAdjustedViewRef.current && containerRef.current) {
        const container = containerRef.current;
        const page = await document.getPage(best.page);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const focusedZoom = labelZoomForSpotlight(base.width, base.height,
          container.clientWidth, container.clientHeight, spotlight);
        autoFocusPendingRef.current = true;
        zoomRef.current = focusedZoom;
        setZoom(focusedZoom);
      }
      setHighlightedPage(best);
      if (!manuallyChangedPage.current) setPageNumber(best.page);
      const qualifier = outlined.mode === "source" ? "extracted wording"
        : outlined.mode === "suggested" ? "suggested-field wording, not the extracted name"
          : "approximate wording";
      setHint(`Spotlighted ${best.boxes.length > 1 ? `one of ${best.boxes.length} possible locations` : "a possible location"} for “${outlined.text}” (${qualifier}, saved scan). Verify it against the label; this is not an approval.`);
    })().catch(() => {
      if (!cancelled) setHint("Saved text positions are unavailable. Please inspect the label manually.");
    }).finally(() => {
      if (!cancelled) onScanSettledRef.current?.();
    });
    return () => { cancelled = true; };
  }, [document, labelId, sourceName, suggestedFieldName, prefetchOnly]);

  useEffect(() => {
    if (!document || prefetchOnly || !viewSize.width || !viewSize.height) return;
    let cancelled = false;
    let renderTask: ReturnType<import("pdfjs-dist").PDFPageProxy["render"]> | null = null;
    let scratch: HTMLCanvasElement | null = null;
    if (renderedPageRef.current?.document !== document || renderedPageRef.current.page !== pageNumber) setLoading(true);
    setError(false);
    const timer = window.setTimeout(() => { void (async () => {
      // pdf.js cannot render onto a canvas until the previous task has stopped.
      const previous = activeRenderRef.current;
      if (previous) {
        previous.cancel();
        await previous.promise.catch(() => undefined);
      }
      if (cancelled) return;
      const page = await document.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const geometry = labelRenderGeometry(base.width, base.height, viewSize.width, viewSize.height, zoom, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: geometry.scale });
      // Render separately so a trackpad gesture keeps the last finished page visible.
      scratch = window.document.createElement("canvas");
      scratch.width = geometry.bitmapWidth;
      scratch.height = geometry.bitmapHeight;
      const scratchContext = scratch.getContext("2d");
      if (!scratchContext) throw new Error("Label canvas is unavailable");
      renderTask = page.render({
        canvas: scratch,
        canvasContext: scratchContext,
        viewport,
        transform: [geometry.outputScale, 0, 0, geometry.outputScale, 0, 0],
      });
      activeRenderRef.current = renderTask;
      await renderTask.promise;
      if (cancelled) return;
      const canvas = canvasRef.current;
      const pageElement = pageRef.current;
      if (!canvas || !pageElement) throw new Error("Label canvas is unavailable");
      canvas.width = geometry.bitmapWidth;
      canvas.height = geometry.bitmapHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Label canvas is unavailable");
      context.drawImage(scratch, 0, 0);
      canvas.style.width = `${geometry.width}px`;
      canvas.style.height = `${geometry.height}px`;
      pageElement.style.width = `${geometry.width}px`;
      pageElement.style.height = `${geometry.height}px`;
      pageElement.style.marginTop = `${Math.max(0, (viewSize.height - geometry.height) / 2)}px`;
      renderedPageRef.current = { document, page: pageNumber };
      renderedZoomRef.current = zoom;
      setLoading(false);
      setRenderRevision((revision) => revision + 1);
    })().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    }).finally(() => {
      if (activeRenderRef.current === renderTask) activeRenderRef.current = null;
      if (scratch) { scratch.width = 0; scratch.height = 0; }
    });
    }, 70);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      renderTask?.cancel();
    };
  }, [document, pageNumber, prefetchOnly, viewSize, zoom]);

  useEffect(() => {
    if (loading || !renderRevision) return;
    if (pendingAnchorRef.current && Math.abs(renderedZoomRef.current - zoomRef.current) > 0.002) return;
    if (autoFocusPendingRef.current && Math.abs(renderedZoomRef.current - zoomRef.current) > 0.002) return;
    const container = containerRef.current;
    const page = pageRef.current;
    if (!container || !page) return;
    const anchor = pendingAnchorRef.current;
    if (anchor) {
      pendingAnchorRef.current = null;
      container.scrollLeft = page.offsetLeft + anchor.pageX * page.clientWidth - anchor.viewportX;
      container.scrollTop = page.offsetTop + anchor.pageY * page.clientHeight - anchor.viewportY;
      return;
    }
    if (autoFocusPendingRef.current && highlightedPage?.page === pageNumber) {
      autoFocusPendingRef.current = false;
      const spotlight = spotlightForLabelHighlight(highlightedPage.boxes[0]);
      const scroll = labelSpotlightScroll(page.clientWidth, page.clientHeight,
        container.clientWidth, container.clientHeight, spotlight);
      container.scrollLeft = page.offsetLeft + scroll.left;
      container.scrollTop = page.offsetTop + scroll.top;
      return;
    }
    if (manuallyAdjustedViewRef.current) return;
    const marker = firstHighlightRef.current;
    if (highlightedPage?.page === pageNumber && marker) {
      container.scrollTop = Math.max(0, page.offsetTop + marker.offsetTop - 120);
      container.scrollLeft = Math.max(0, page.offsetLeft + marker.offsetLeft - container.clientWidth / 2);
    }
  }, [loading, highlightedPage, pageNumber, renderRevision]);

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
          <button type="button" disabled={pageNumber === 1} onClick={() => { manuallyChangedPage.current = true; manuallyAdjustedViewRef.current = true; setPageNumber(pageNumber - 1); }}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Previous</button>
          <span>Page {pageNumber} of {pageCount}</span>
          <button type="button" disabled={pageNumber === pageCount} onClick={() => { manuallyChangedPage.current = true; manuallyAdjustedViewRef.current = true; setPageNumber(pageNumber + 1); }}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
        </> : null}
        <button type="button" aria-label="Zoom out" disabled={zoom <= MIN_LABEL_ZOOM + 0.01} onClick={() => zoomFromCenter(nextLabelZoom(zoom, -1))}
          className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40">−</button>
        <button type="button" onClick={() => zoomFromCenter(1)}
          className="min-w-32 rounded border border-slate-300 px-2 py-1">{Math.round(zoom * 100)}% · {zoom > 1.01 ? "Fit page" : "Whole page"}</button>
        <button type="button" aria-label="Zoom in" disabled={zoom >= MAX_LABEL_ZOOM - 0.01} onClick={() => zoomFromCenter(nextLabelZoom(zoom, 1))}
          className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40">+</button>
        <button type="button" onClick={() => setExpanded((value) => !value)}
          className="rounded border border-slate-300 px-2 py-1">{expanded ? "Close expanded view" : "Expand label"}</button>
        <span className="text-xs text-slate-500">Pinch to zoom</span>
      </div>
      <div ref={containerRef} className={expanded
        ? "relative min-h-0 flex-1 overflow-auto text-center"
        : "relative overflow-auto text-center"}
        style={{ touchAction: "pan-x pan-y", ...(!expanded ? { height: "min(520px, 65vh)", minHeight: "320px" } : {}) }}>
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
          {visibleBox?.relatedBoxes?.map((value, index) => <span key={index} aria-hidden="true"
            className="pointer-events-none absolute z-20 rounded-sm"
            style={{ left: `${value.left}%`, top: `${value.top}%`, width: `${value.width}%`, height: `${value.height}%`,
              outline: "2px solid #f59e0b", outlineOffset: "7px" }} />)}
        </div>
      </div>
    </div>
  );
}
