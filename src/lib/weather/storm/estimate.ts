/**
 * Heuristische Schätzwerte aus den vorhandenen Detektions-Features.
 * Wir haben kein echtes dBZ/Echotop pro Zelle (Blitz + Open-Meteo).
 * Diese Werte sind grobe Proxies fürs Map-Label, klar als Schätzung markiert.
 */
import { bearingDeg, distanceKm, toRad } from "./geo";
import type { StormCell } from "./types";

/** dBZ-Proxy 25..62 aus Strike-Rate, Trend, Kompaktheit. */
export function estimateReflectivityDbz(cell: StormCell): number {
  const rate = cell.strikeRatePerMin;
  const trendBoost = cell.strikeRateTrend > 1 ? Math.min(6, (cell.strikeRateTrend - 1) * 6) : 0;
  const density = cell.radiusKm > 0 ? cell.strikeCount / cell.radiusKm : 0;
  const densityBoost = Math.min(6, density * 2);
  const base = 25 + Math.min(28, rate * 7);
  return Math.round(Math.min(62, base + trendBoost + densityBoost));
}

/** Echotop-Proxy in km aus Severity-Score und Cluster-Aktivität. */
export function estimateEchoTopKm(cell: StormCell): number {
  const s = cell.severity.score; // 0..100
  const km = 5 + s / 12 + Math.min(3, cell.strikeRatePerMin * 0.4);
  return Math.round(Math.min(14, km) * 10) / 10;
}

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
 * Verwendet aktuelle Geschwindigkeit und Bewegungsrichtung.
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