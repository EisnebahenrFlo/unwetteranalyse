import type { RadarCell } from "@/lib/weather/radar/snapshot";
import { buildForecast } from "./forecast";
import { scoreCell } from "./severity";
import { bearingCompass, bearingDeg, distanceKm } from "./geo";
import {
  DEFAULT_STORM_THRESHOLDS,
  type StormCell,
  type StormCentroidPoint,
  type StormEnvironment,
  type StormMotion,
  type StormThresholds,
} from "./types";

/**
 * Persistenter Zustand pro Track. Lebt im Modul-Scope (Memory),
 * damit IDs/Historie zwischen Frames erhalten bleiben.
 */
interface InternalTrack {
  id: string;
  firstSeen: number;
  lastSeen: number;
  history: StormCentroidPoint[];
}

const tracks = new Map<string, InternalTrack>();
let nextId = 1;

function freshId() {
  const id = `cell-${String(nextId).padStart(3, "0")}`;
  nextId++;
  return id;
}

/**
 * Bewegung aus den letzten Centroiden schätzen.
 * Speed = Distanz / Zeit über die letzten Punkte, Bearing vom ältesten
 * brauchbaren Punkt zum jüngsten. Confidence aus Streuung der Inkremental-
 * Bearings.
 */
function estimateMotion(history: StormCentroidPoint[]): StormMotion | null {
  if (history.length < 2) return null;
  const recent = history.slice(-6);
  const newest = recent[recent.length - 1];
  const oldest = recent[0];
  const dtMin = (newest.time - oldest.time) / 60_000;
  if (dtMin < 4) return null;
  const dist = distanceKm(oldest, newest);
  const speedKmh = (dist / dtMin) * 60;
  if (speedKmh < 2) return { speedKmh: 0, bearingDeg: 0, bearingCompass: "·", confidence: 0.3 };
  const bDeg = bearingDeg(oldest, newest);

  let consistency = 1;
  if (recent.length >= 3) {
    const diffs: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      const b = bearingDeg(recent[i - 1], recent[i]);
      let d = Math.abs(b - bDeg);
      if (d > 180) d = 360 - d;
      diffs.push(d);
    }
    const avg = diffs.reduce((s, x) => s + x, 0) / diffs.length;
    consistency = Math.max(0.2, 1 - avg / 90);
  }

  return {
    speedKmh,
    bearingDeg: bDeg,
    bearingCompass: bearingCompass(bDeg),
    confidence: Math.min(1, consistency),
  };
}

/**
 * Greedy-Matching: jede neue Zelle bekommt den nächsten Track unter matchKm.
 * Einfach, robust, ohne Hungarian-Overhead.
 */
function matchTracks(
  candidates: RadarCell[],
  thresholds: StormThresholds,
  now: number,
): (string | null)[] {
  const alive = [...tracks.values()].filter((t) => now - t.lastSeen <= thresholds.ttlMin * 60_000);
  const used = new Set<string>();
  const out: (string | null)[] = [];

  for (const c of candidates) {
    let bestId: string | null = null;
    let bestDist = thresholds.matchKm;
    for (const t of alive) {
      if (used.has(t.id)) continue;
      const last = t.history[t.history.length - 1];
      if (!last) continue;
      const d = distanceKm(c.centroid, last);
      if (d < bestDist) {
        bestDist = d;
        bestId = t.id;
      }
    }
    if (bestId) used.add(bestId);
    out.push(bestId);
  }
  return out;
}

function computeTrends(history: StormCentroidPoint[]): { dbzTrend: number; areaTrend: number } {
  if (history.length < 2) return { dbzTrend: 0, areaTrend: 1 };
  const newest = history[history.length - 1];
  // Vergleichspunkt: ~10–15 min zurück.
  let ref = history[0];
  for (let i = history.length - 2; i >= 0; i--) {
    if (newest.time - history[i].time >= 10 * 60_000) {
      ref = history[i];
      break;
    }
  }
  const dbzTrend = newest.topDbz - ref.topDbz;
  const areaTrend = ref.areaKm2 > 0 ? newest.areaKm2 / ref.areaKm2 : 1;
  return { dbzTrend, areaTrend };
}

/**
 * Ein Tracking-Schritt. Nimmt die Radar-Zellen des aktuellen Frames und
 * aktualisiert/erzeugt Tracks.
 */
export function stepStormTracking(
  radarCells: RadarCell[],
  env: StormEnvironment,
  now = Date.now(),
  thresholds: StormThresholds = DEFAULT_STORM_THRESHOLDS,
): StormCell[] {
  const matched = matchTracks(radarCells, thresholds, now);
  const seen = new Set<string>();
  const cells: StormCell[] = [];

  radarCells.forEach((rc, i) => {
    const id = matched[i] ?? freshId();
    seen.add(id);
    const existing = tracks.get(id);
    const point: StormCentroidPoint = {
      time: now,
      lat: rc.centroid.lat,
      lon: rc.centroid.lon,
      topDbz: rc.topDbz,
      areaKm2: rc.areaKm2,
    };
    const history = existing ? [...existing.history, point] : [point];
    const trimmed = history.filter((h) => now - h.time <= 60 * 60_000);
    const track: InternalTrack = {
      id,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
      history: trimmed,
    };
    tracks.set(id, track);

    const motion = estimateMotion(trimmed);
    const { forecast, cone } = buildForecast(rc.centroid, motion, trimmed);
    const { dbzTrend, areaTrend } = computeTrends(trimmed);
    const severity = scoreCell({
      topDbz: rc.topDbz,
      hailCoreAreaKm2: rc.hailCoreAreaKm2,
      areaKm2: rc.areaKm2,
      dbzTrend,
      areaTrend,
      env,
    });

    cells.push({
      id,
      firstSeen: track.firstSeen,
      lastSeen: track.lastSeen,
      centroid: rc.centroid,
      polygon: rc.polygon,
      radiusKm: rc.radiusKm,
      areaKm2: rc.areaKm2,
      topDbz: rc.topDbz,
      hailCorePixels: rc.hailCorePixels,
      hailCoreAreaKm2: rc.hailCoreAreaKm2,
      dbzTrend,
      areaTrend,
      history: trimmed,
      motion,
      forecast,
      cone,
      severity,
    });
  });

  // TTL-Cleanup: alte Tracks ohne Update entfernen.
  for (const [id, t] of tracks) {
    if (!seen.has(id) && now - t.lastSeen > thresholds.ttlMin * 60_000) tracks.delete(id);
  }

  cells.sort((a, b) => b.severity.score - a.severity.score || b.areaKm2 - a.areaKm2);
  return cells;
}

/** Reset für Tests / Settings-Wechsel. */
export function resetStormTracking() {
  tracks.clear();
  nextId = 1;
}

export function exportTrackState(): InternalTrack[] {
  return [...tracks.values()].map((t) => ({
    id: t.id,
    firstSeen: t.firstSeen,
    lastSeen: t.lastSeen,
    history: t.history.slice(),
  }));
}

export function importTrackState(entries: InternalTrack[], now = Date.now()) {
  const cutoff = now - 60 * 60_000;
  for (const e of entries) {
    if (!e || typeof e.id !== "string") continue;
    const history = (e.history ?? []).filter((h) => h && h.time >= cutoff);
    if (history.length === 0) continue;
    tracks.set(e.id, {
      id: e.id,
      firstSeen: e.firstSeen ?? history[0].time,
      lastSeen: e.lastSeen ?? history[history.length - 1].time,
      history,
    });
    const num = e.id.match(/cell-(\d+)/);
    if (num) {
      const n = parseInt(num[1], 10);
      if (Number.isFinite(n) && n >= nextId) nextId = n + 1;
    }
  }
}