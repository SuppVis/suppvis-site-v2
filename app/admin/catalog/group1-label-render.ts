export const LABEL_ZOOM_LEVELS = [1, 1.5, 2, 3, 4] as const;

const MAX_CANVAS_PIXELS = 24_000_000;
const MAX_CANVAS_EDGE = 8192;

export function labelRenderGeometry(baseWidth: number, baseHeight: number, availableWidth: number, zoom: number, devicePixelRatio: number) {
  const scale = (Math.max(1, availableWidth - 2) / baseWidth) * zoom;
  const width = baseWidth * scale;
  const height = baseHeight * scale;
  // Rerender the PDF at each zoom level, while bounding backing-store memory.
  const outputScale = Math.min(
    Math.max(1, devicePixelRatio),
    2,
    Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
    MAX_CANVAS_EDGE / Math.max(width, height),
  );
  return {
    scale,
    width,
    height,
    outputScale,
    bitmapWidth: Math.max(1, Math.floor(width * outputScale)),
    bitmapHeight: Math.max(1, Math.floor(height * outputScale)),
  };
}
