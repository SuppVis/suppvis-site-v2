export const LABEL_ZOOM_LEVELS = [1, 1.5, 2, 3, 4] as const;
export const MIN_LABEL_ZOOM = LABEL_ZOOM_LEVELS[0];
export const MAX_LABEL_ZOOM = LABEL_ZOOM_LEVELS[LABEL_ZOOM_LEVELS.length - 1];

const MAX_CANVAS_PIXELS = 24_000_000;
const MAX_CANVAS_EDGE = 8192;

export function clampLabelZoom(zoom: number) {
  return Math.min(MAX_LABEL_ZOOM, Math.max(MIN_LABEL_ZOOM, zoom));
}

export function nextLabelZoom(zoom: number, direction: -1 | 1) {
  return direction > 0
    ? LABEL_ZOOM_LEVELS.find((level) => level > zoom + 0.01) ?? MAX_LABEL_ZOOM
    : [...LABEL_ZOOM_LEVELS].reverse().find((level) => level < zoom - 0.01) ?? MIN_LABEL_ZOOM;
}

export function labelRenderGeometry(baseWidth: number, baseHeight: number, availableWidth: number, availableHeight: number, zoom: number, devicePixelRatio: number) {
  const fitScale = Math.min(
    Math.max(1, availableWidth - 16) / baseWidth,
    Math.max(1, availableHeight - 16) / baseHeight,
  );
  const scale = fitScale * clampLabelZoom(zoom);
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
