import type { LightningStrike } from "@/lib/weather/sources/blitzortung";
import { dbscanStrikes } from "./detect";
import { buildForecast } from "./forecast";
import { scoreCell } from "./severity";
import {
  bearingCompass,
  bearingDeg,
  centroidOf,
  convexHull,
  distanceKm,
  radiusKm,
} from "./geo";
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
 * damit IDs/Historie zwischen Frames erhalten bleiben. Beim Tab-Reload
 * starten wir bewusst leer — die Detection läuft binnen Sekunden wieder an.
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
 * Speed = mittlere Distanz/Zeit zwischen aufeinanderfolgenden Punkten,
 * Bearing = vom ältesten brauchbaren Punkt zum jüngsten.
 * Confidence: 1 bei wenig Streuung der Inkremental-Bearings, sinkt bei Zickzack.
 */
function estimateMotion(history: StormCentroidPoint[]): StormMotion | null {
  if (history.length < 2) return null;
  const recent = history.slice(-6);
  const newest = recent[recent.length - 1];
  const oldest = recent[0];
  const dtMin = (newest.time - oldest.time) / 60_000;
  if (dtMin < 2) return null;
  const dist = distanceKm(oldest, newest);
  const speedKmh = (dist / dtMin) * 60;
  if (speedKmh < 1) return { speedKmh: 0, bearingDeg: 0, bearingCompass: "·", confidence: 0.3 };
  const bDeg = bearingDeg(oldest, newest);

  // Confidence aus Konsistenz der Inkremental-Bearings.
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

function computeRates(strikes: LightningStrike[], now: number) {
  const last5 = strikes.filter((s) => now - s.time <= 5 * 60_000).length;
  const prev5 = strikes.filter((s) => now - s.time > 5 * 60_000 && now - s.time <= 10 * 60_000).length;
  const rate = last5 / 5;
  const trend = prev5 === 0 ? (last5 > 0 ? 2 : 0) : last5 / prev5;
  return { rate, trend };
}

/**
 * Greedy-Matching: jeder neue Cluster bekommt den nächsten Track unter matchKm.
 * Einfach, robust, ohne Hungarian-Overhead. Bei zwei sehr nahen Clustern liefert
 * Greedy in der Praxis identische Ergebnisse zu optimalem Matching.
 */
function matchTracks(
  candidates: { centroid: { lat: number; lon: number } }[],
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

/**
 * Ein Detection-/Tracking-Schritt. Strikes sind die letzten ~60 min,
 * intern wird das Detection-Fenster auf windowMin geclippt.
 */
export function stepStormTracking(
  strikes: LightningStrike[],
  env: StormEnvironment,
  now = Date.now(),
  thresholds: StormThresholds = DEFAULT_STORM_THRESHOLDS,
): StormCell[] {
  const windowMs = thresholds.windowMin * 60_000;
  const recent = strikes.filter((s) => now - s.time <= windowMs);

  const raw = dbscanStrikes(recent, thresholds.eps, thresholds.minPts);
  const candidates = raw.map((c) => {
    const centroid = centroidOf(c.strikes);
    return { centroid, strikes: c.strikes };
  });

  const matched = matchTracks(candidates, thresholds, now);
  const seen = new Set<string>();
  const cells: StormCell[] = [];

  candidates.forEach((c, i) => {
    const id = matched[i] ?? freshId();
    seen.add(id);
    const existing = tracks.get(id);
    const point: StormCentroidPoint = {
      time: now,
      lat: c.centroid.lat,
      lon: c.centroid.lon,
      strikes: c.strikes.length,
    };
    const history = existing ? [...existing.history, point] : [point];
    // Historie auf 60 min trimmen.
    const trimmed = history.filter((h) => now - h.time <= 60 * 60_000);
    const track: InternalTrack = {
      id,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
      history: trimmed,
    };
    tracks.set(id, track);

    const motion = estimateMotion(trimmed);
    const { forecast, cone } = buildForecast(c.centroid, motion, trimmed);
    const rd = radiusKm(c.centroid, c.strikes);
    const { rate, trend } = computeRates(c.strikes, now);
    const severity = scoreCell({
      strikeRatePerMin: rate,
      strikeRateTrend: trend,
      radiusKm: rd,
      strikeCount: c.strikes.length,
      env,
    });

    cells.push({
      id,
      firstSeen: track.firstSeen,
      lastSeen: track.lastSeen,
      centroid: c.centroid,
      polygon: convexHull(c.strikes),
      radiusKm: rd,
      strikeCount: c.strikes.length,
      strikeRatePerMin: rate,
      strikeRateTrend: trend,
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

  // Sortierung: Severity desc, dann Strike-Count.
  cells.sort((a, b) => b.severity.score - a.severity.score || b.strikeCount - a.strikeCount);
  return cells;
}

/** Reset für Tests / Settings-Wechsel. */
export function resetStormTracking() {
  tracks.clear();
  nextId = 1;
}

/** Serialisierbarer Snapshot aller laufenden Tracks (für Persistenz). */
export function exportTrackState(): InternalTrack[] {
  return [...tracks.values()].map((t) => ({
    id: t.id,
    firstSeen: t.firstSeen,
    lastSeen: t.lastSeen,
    history: t.history.slice(),
  }));
}

/**
 * Lädt persistierte Tracks zurück in den Modul-Scope. Verworfen werden
 * Einträge ohne brauchbare Historie der letzten 60 min, damit alte
 * Zellen nach langer Pause nicht künstlich wiederbelebt werden.
 */
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