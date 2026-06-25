/**
 * Connected-Component-Labeling auf einer Intensitäts-Maske.
 * Liefert Zellen mit Centroid, BBox, Pixelzahl, Top-Stufe und einem
 * vereinfachten Polygon der Außenkante.
 */
import type { IntensityLevel } from "./palette";
import { CELL_MIN_LEVEL, DBZ_FOR_LEVEL, HAIL_CORE_LEVEL } from "./palette";

export interface PixelCell {
  pixels: number;
  /** Pixel-Index der zugehörigen Bounding-Box-Ecken. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Sub-Pixel-Centroid (Mittelwert aller Pixel-Koordinaten). */
  cx: number;
  cy: number;
  /** Maximale Intensitätsstufe in der Zelle. */
  topLevel: IntensityLevel;
  /** Pixelzahl im Hagelkern (Stufe ≥ HAIL_CORE_LEVEL). */
  hailCorePixels: number;
  /** Summe der Intensitätsstufen aller Pixel (für Mittelwertbildung). */
  sumLevel: number;
  /** Vereinfachter Außenring (Pixel-Koordinaten, geschlossen). */
  polygon: Array<[number, number]>;
}

/**
 * Zwei-Pass Connected-Component Labeling mit 4-Konnektivität auf der
 * binarisierten Maske (level ≥ CELL_MIN_LEVEL). Anschließend werden
 * Aggregat-Statistiken pro Label gesammelt.
 */
export function detectCells(
  mask: Uint8Array,
  width: number,
  height: number,
  minPixels = 8,
): PixelCell[] {
  const n = width * height;
  const labels = new Int32Array(n);
  const parent: number[] = [0];

  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    let cur = i;
    while (parent[cur] !== r) {
      const next = parent[cur];
      parent[cur] = r;
      cur = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  // Pass 1: Provisional labels.
  let nextLabel = 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] < CELL_MIN_LEVEL) continue;
      const left = x > 0 ? labels[i - 1] : 0;
      const up = y > 0 ? labels[i - width] : 0;
      if (left === 0 && up === 0) {
        labels[i] = nextLabel;
        parent[nextLabel] = nextLabel;
        nextLabel++;
      } else if (left !== 0 && up === 0) labels[i] = left;
      else if (left === 0 && up !== 0) labels[i] = up;
      else {
        labels[i] = Math.min(left, up);
        if (left !== up) union(left, up);
      }
    }
  }

  // Pass 2: Aggregation pro Wurzel-Label.
  interface Acc {
    pixels: number;
    sumX: number;
    sumY: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    topLevel: IntensityLevel;
    hailCorePixels: number;
    sumLevel: number;
    coords: Array<[number, number]>;
  }
  const acc = new Map<number, Acc>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const l = labels[i];
      if (l === 0) continue;
      const root = find(l);
      let a = acc.get(root);
      if (!a) {
        a = {
          pixels: 0,
          sumX: 0,
          sumY: 0,
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
          topLevel: 0,
          hailCorePixels: 0,
          sumLevel: 0,
          coords: [],
        };
        acc.set(root, a);
      }
      a.pixels++;
      a.sumX += x;
      a.sumY += y;
      if (x < a.minX) a.minX = x;
      if (x > a.maxX) a.maxX = x;
      if (y < a.minY) a.minY = y;
      if (y > a.maxY) a.maxY = y;
      const lvl = mask[i] as IntensityLevel;
      if (lvl > a.topLevel) a.topLevel = lvl;
      if (lvl >= HAIL_CORE_LEVEL) a.hailCorePixels++;
      a.sumLevel += lvl;
      a.coords.push([x, y]);
    }
  }

  const cells: PixelCell[] = [];
  for (const a of acc.values()) {
    if (a.pixels < minPixels) continue;
    cells.push({
      pixels: a.pixels,
      minX: a.minX,
      minY: a.minY,
      maxX: a.maxX,
      maxY: a.maxY,
      cx: a.sumX / a.pixels,
      cy: a.sumY / a.pixels,
      topLevel: a.topLevel,
      hailCorePixels: a.hailCorePixels,
      sumLevel: a.sumLevel,
      polygon: convexHullPixels(a.coords),
    });
  }
  return cells;
}

/** Andrew's Monotone Chain auf Pixel-Punkten (Sub-Pixel reicht nicht). */
function convexHullPixels(pts: Array<[number, number]>): Array<[number, number]> {
  if (pts.length <= 1) return pts.slice();
  // Deduplizieren + sortieren.
  const sorted = [...new Set(pts.map((p) => `${p[0]},${p[1]}`))].map(
    (s) => s.split(",").map(Number) as [number, number],
  );
  sorted.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Array<[number, number]> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

export { DBZ_FOR_LEVEL };