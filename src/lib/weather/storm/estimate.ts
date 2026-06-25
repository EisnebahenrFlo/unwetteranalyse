import { bearingDeg, distanceKm, toRad } from "./geo";
import type { StormCell } from "./types";

export interface NamedTarget {
  name: string;
  lat: number;
  lon: number;
}

export interface CellEta {
  target: NamedTarget;
  minutes: number;
  distanceKm: number;
}

/**
 * Liefert ETA der Zelle zum nächsten Ziel auf ihrer Bahn (±60°, max 25 km seitlich).
 */
export function etaToNearestTarget(cell: StormCell, targets: NamedTarget[]): CellEta | null {
  const motion = cell.motion;
  if (!motion || motion.speedKmh < 5 || targets.length === 0) return null;
  let best: CellEta | null = null;
  for (const t of targets) {
    const d = distanceKm(cell.centroid, t);
    if (d < 1) continue;
    if (d > 80) continue;
    const brg = bearingDeg(cell.centroid, t);
    const diff = Math.abs(((brg - motion.bearingDeg + 540) % 360) - 180);
    if (diff > 60) continue;
    const along = d * Math.cos(toRad(diff));
    if (along <= 0) continue;
    const perp = d * Math.sin(toRad(diff));
    if (perp > 25) continue;
    const minutes = Math.round((along / motion.speedKmh) * 60);
    if (minutes < 0 || minutes > 90) continue;
    if (!best || minutes < best.minutes) best = { target: t, minutes, distanceKm: d };
  }
  return best;
}