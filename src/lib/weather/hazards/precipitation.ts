/**
 * Per-Cell Niederschlag + Freezing Level vom Open-Meteo Forecast.
 *
 * Wir runden Centroide auf ein ~0.25°-Grid, dedupe, batchen mit
 * komma-separierten Koordinaten in einen Request. Liefert für jeden Punkt:
 *  - 1 h / 3 h / 6 h / 24 h Niederschlags-Akkumulation (mm), Fenster ENDET
 *    auf der aktuellen vollen Stunde (forecast+past).
 *  - Aktuelles Freezing Level (m AGL).
 *
 * Cache TTL 10 min, weil sich Niederschlag schneller ändert als CAPE/LI.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GRID_DEG = 0.25;
const TTL_MS = 10 * 60_000;
const MAX_BATCH = 25;

export interface CellPrecipSample {
  rrH1: number | null;
  rrH3: number | null;
  rrH6: number | null;
  rrH24: number | null;
  freezingLevelM: number | null;
  validFor: string | null;
  fetchedAt: number;
}

const cache = new Map<string, CellPrecipSample>();
const inflight = new Map<string, Promise<void>>();

export function precipKey(lat: number, lon: number) {
  const la = Math.round(lat / GRID_DEG) * GRID_DEG;
  const lo = Math.round(lon / GRID_DEG) * GRID_DEG;
  return `${la.toFixed(2)}:${lo.toFixed(2)}`;
}

function parseKey(key: string) {
  const [la, lo] = key.split(":").map(Number);
  return { lat: la, lon: lo };
}

function pickCurrentHourIdx(times: string[], now: number): number {
  if (!times.length) return -1;
  let bestIdx = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = Date.parse(times[i]);
    if (!Number.isFinite(t)) continue;
    const d = Math.abs(t - now);
    if (d < bestDelta) {
      bestDelta = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function sumWindow(values: number[] | undefined, endIdx: number, hours: number): number | null {
  if (!Array.isArray(values)) return null;
  const startIdx = Math.max(0, endIdx - hours + 1);
  let sum = 0;
  let hits = 0;
  for (let i = startIdx; i <= endIdx; i++) {
    const v = values[i];
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v;
      hits++;
    }
  }
  return hits > 0 ? sum : null;
}

async function fetchBatch(keys: string[]) {
  if (!keys.length) return;
  const points = keys.map(parseKey);
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", points.map((p) => p.lat.toFixed(2)).join(","));
  url.searchParams.set("longitude", points.map((p) => p.lon.toFixed(2)).join(","));
  url.searchParams.set("hourly", "precipitation,freezing_level_height");
  url.searchParams.set("past_days", "1");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "UTC");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo precip HTTP ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : [json];
  const now = Date.now();

  keys.forEach((key, i) => {
    const entry = list[i];
    const hourly = entry?.hourly ?? {};
    const times: string[] = hourly.time ?? [];
    const idx = pickCurrentHourIdx(times, now);
    if (idx < 0) {
      cache.set(key, { rrH1: null, rrH3: null, rrH6: null, rrH24: null, freezingLevelM: null, validFor: null, fetchedAt: now });
      return;
    }
    const precip = hourly.precipitation as number[] | undefined;
    const fl = hourly.freezing_level_height as number[] | undefined;
    cache.set(key, {
      rrH1: sumWindow(precip, idx, 1),
      rrH3: sumWindow(precip, idx, 3),
      rrH6: sumWindow(precip, idx, 6),
      rrH24: sumWindow(precip, idx, 24),
      freezingLevelM: typeof fl?.[idx] === "number" ? fl[idx] : null,
      validFor: times[idx] ?? null,
      fetchedAt: now,
    });
  });
}

export async function loadCellPrecipitation(
  points: { lat: number; lon: number }[],
): Promise<Map<string, CellPrecipSample>> {
  const now = Date.now();
  const keys = Array.from(new Set(points.map((p) => precipKey(p.lat, p.lon))));
  const stale = keys.filter((k) => {
    const hit = cache.get(k);
    return !hit || now - hit.fetchedAt > TTL_MS;
  });
  const toFetch = stale.filter((k) => !inflight.has(k));

  for (let i = 0; i < toFetch.length; i += MAX_BATCH) {
    const slice = toFetch.slice(i, i + MAX_BATCH);
    const promise = fetchBatch(slice).catch((err) => {
      console.warn("[hazards] precip fetch failed", err);
      const now2 = Date.now();
      slice.forEach((k) => {
        if (!cache.has(k)) {
          cache.set(k, { rrH1: null, rrH3: null, rrH6: null, rrH24: null, freezingLevelM: null, validFor: null, fetchedAt: now2 });
        }
      });
    }).finally(() => {
      slice.forEach((k) => inflight.delete(k));
    });
    slice.forEach((k) => inflight.set(k, promise));
  }

  const waits = keys.map((k) => inflight.get(k)).filter(Boolean) as Promise<void>[];
  if (waits.length) await Promise.allSettled(waits);

  const out = new Map<string, CellPrecipSample>();
  for (const k of keys) {
    const hit = cache.get(k);
    if (hit) out.set(k, hit);
  }
  return out;
}

export function resetCellPrecipitationCache() {
  cache.clear();
  inflight.clear();
}