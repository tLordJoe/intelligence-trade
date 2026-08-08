export function nearestTimestampIndex(timestamps: number[], target: number): number {
  if (!timestamps.length) return -1;
  let low = 0;
  let high = timestamps.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (timestamps[mid] < target) low = mid + 1;
    else high = mid;
  }

  if (low === 0) return 0;
  const previous = low - 1;
  return Math.abs(timestamps[low] - target) < Math.abs(timestamps[previous] - target)
    ? low
    : previous;
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return -1;
  return Math.min(Math.max(index, 0), length - 1);
}

export function clientPointToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;

  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}
