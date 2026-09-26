"use client";

import { useEffect, useRef, useState } from "react";

type PdfDocument = import("pdfjs-dist").PDFDocumentProxy;

export function Group1LabelPreview({ labelId }: { labelId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof import("pdfjs-dist").getDocument> | null = null;
    setDocument(null);
    setPageNumber(1);
    setPageCount(0);
    setError(false);
    setLoading(true);
    void import("pdfjs-dist").then(async (pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url,
      ).toString();
      loadingTask = pdfjs.getDocument({ url: `/api/admin/group1-label/${labelId}` });
      const loaded = await loadingTask.promise;
      if (cancelled) return;
      setDocument(loaded);
      setPageCount(loaded.numPages);
    }).catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
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

  return (
    <div className="rounded border border-white/15 bg-white text-slate-800">
      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-3 border-b border-slate-200 bg-slate-100 p-2 text-sm">
          <button type="button" disabled={pageNumber === 1} onClick={() => setPageNumber(pageNumber - 1)}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Previous</button>
          <span>Page {pageNumber} of {pageCount}</span>
          <button type="button" disabled={pageNumber === pageCount} onClick={() => setPageNumber(pageNumber + 1)}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      ) : null}
      <div ref={containerRef} className="relative max-h-[520px] min-h-[420px] overflow-auto text-center">
        {loading ? <p className="p-6 text-sm">Loading label image…</p> : null}
        {error ? <p className="p-6 text-sm">Preview unavailable. Use “Open label PDF” above.</p> : null}
        <canvas ref={canvasRef} aria-label={`DSLD label ${labelId}, page ${pageNumber}`}
          className={`mx-auto ${loading || error ? "hidden" : "block"}`} />
      </div>
    </div>
  );
}
