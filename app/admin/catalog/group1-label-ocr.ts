import type { Worker } from "tesseract.js";
import type { LabelOcrPage } from "./group1-label-highlight";

const assets = "/ocr/tesseract-7-eng-1";
const cache = new Map<string, LabelOcrPage>();
const cacheLimit = 16;
export type LabelOcrMode = "sparse" | "singleBlock";
type LabelWorker = Pick<Worker, "recognize" | "setParameters" | "terminate">;

async function makeLabelWorker(): Promise<LabelWorker> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    workerPath: `${assets}/worker.min.js`, corePath: assets, langPath: assets,
    workerBlobURL: false, errorHandler: () => {},
  });
  try {
    // Facts panels are often narrow columns inside much wider marketing artwork.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return worker;
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

export function cachedLabelOcr(key: string): LabelOcrPage | undefined {
  const result = cache.get(key);
  if (result) { cache.delete(key); cache.set(key, result); }
  return result;
}

export function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

/** One worker per active label search, released on completion/cancellation. */
export function createLabelOcrSession(signal: AbortSignal, makeWorker: () => Promise<LabelWorker> = makeLabelWorker) {
  let worker: LabelWorker | null = null;
  let initializing: Promise<LabelWorker> | null = null;
  let disposed = false;
  let currentMode: LabelOcrMode = "sparse";
  const dispose = () => {
    disposed = true;
    if (worker) { void worker.terminate(); worker = null; }
    signal.removeEventListener("abort", dispose);
  };
  signal.addEventListener("abort", dispose, { once: true });
  return {
    dispose,
    async recognize(canvas: HTMLCanvasElement, key: string, mode: LabelOcrMode = "sparse"): Promise<LabelOcrPage> {
      const cached = cachedLabelOcr(key);
      if (signal.aborted || disposed) throw new DOMException("Cancelled", "AbortError");
      if (cached) return cached;
      if (!initializing) {
        initializing = makeWorker().then(async (ready) => {
          if (signal.aborted || disposed) { await ready.terminate(); throw new DOMException("Cancelled", "AbortError"); }
          worker = ready;
          return ready;
        });
      }
      const active = await abortable(initializing, signal);
      if (currentMode !== mode) {
        const { PSM } = await import("tesseract.js");
        await abortable(active.setParameters({ tessedit_pageseg_mode: mode === "singleBlock" ? PSM.SINGLE_BLOCK : PSM.SPARSE_TEXT }), signal);
        currentMode = mode;
      }
      const { data } = await abortable(active.recognize(canvas, {}, { blocks: true, text: false }), signal);
      const result: LabelOcrPage = { width: canvas.width, height: canvas.height,
        lines: (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.map(
          (line) => line.words.map((word) => ({ text: word.text, confidence: word.confidence, box: word.bbox })),
        ))) };
      if (signal.aborted || disposed) throw new DOMException("Cancelled", "AbortError");
      cache.set(key, result);
      if (cache.size > cacheLimit) cache.delete(cache.keys().next().value!);
      return result;
    },
  };
}
