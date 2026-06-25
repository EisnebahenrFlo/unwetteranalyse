/**
 * Per-Cell CAPE/LI vom Open-Meteo Forecast.
 *
 * Wir runden Centroide auf ein ~0.25°-Grid, deduplizieren und batchen alle
 * benötigten Punkte in einen einzigen Request (Open-Meteo akzeptiert
 * komma-separierte latitude/longitude und liefert ein Array zurück).
 * Ergebnisse landen in einem in-memory Cache mit 20 min TTL, damit der
 * Tracking-Schritt (alle 15 s) keinen Request-Sturm auslöst.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GRID_DEG = 0.25;
const TTL_MS = 20 * 60_000;
const MAX_BATCH = 25;

export interface CellEnvSample {
  cape: number | null;
  liftedIndex: number | null;
  validFor: string | null;
  fetchedAt: number;
}

const cache = new Map<string, CellEnvSample>();
const inflight = new Map<string, Promise<void>>();

export function gridKey(lat: number, lon: number) {
  const la = Math.round(lat / GRID_DEG) * GRID_DEG;
  const lo = Math.round(lon / GRID_DEG) * GRID_DEG;
  return `${la.toFixed(2)}:${lo.toFixed(2)}`;
}

function parseKey(key: string) {
  const [la, lo] = key.split(":").map(Number);
  return { lat: la, lon: lo };
}

function pickCurrentHour(hourly: { time?: string[] } & Record<string, unknown>, now: number) {
  const times = (hourly?.time as string[] | undefined) ?? [];
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

async function fetchBatch(keys: string[]) {
  if (!keys.length) return;
  const points = keys.map(parseKey);
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", points.map((p) => p.lat.toFixed(2)).join(","));
  url.searchParams.set("longitude", points.map((p) => p.lon.toFixed(2)).join(","));
  url.searchParams.set("hourly", "cape,lifted_index");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("past_days", "0");
  url.searchParams.set("timezone", "UTC");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo cell env HTTP ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : [json];
  const now = Date.now();

  keys.forEach((key, i) => {
    const entry = list[i];
    const hourly = entry?.hourly ?? {};
    const idx = pickCurrentHour(hourly, now);
    const cape = idx >= 0 ? (hourly.cape?.[idx] ?? null) : null;
    const li = idx >= 0 ? (hourly.lifted_index?.[idx] ?? null) : null;
    const validFor = idx >= 0 ? (hourly.time?.[idx] ?? null) : null;
    cache.set(key, {
      cape: typeof cape === "number" ? cape : null,
      liftedIndex: typeof li === "number" ? li : null,
      validFor,
      fetchedAt: now,
    });
  });
}

/**
 * Holt CAPE/LI für eine Liste von Centroiden. Fehlt ein Wert (kein Modelldatenpunkt
 * vor Ort, Fetch-Fehler etc.), bleibt der Eintrag undefiniert und der Caller
 * fällt auf den regionalen Proxy zurück.
 */
export async function loadCellEnvironments(
  points: { lat: number; lon: number }[],
): Promise<Map<string, CellEnvSample>> {
  const now = Date.now();
  const keys = Array.from(new Set(points.map((p) => gridKey(p.lat, p.lon))));
  const stale = keys.filter((k) => {
    const hit = cache.get(k);
    return !hit || now - hit.fetchedAt > TTL_MS;
  });

  // Dedupe parallele Anfragen pro Key.
  const toFetch = stale.filter((k) => !inflight.has(k));

  for (let i = 0; i < toFetch.length; i += MAX_BATCH) {
    const slice = toFetch.slice(i, i + MAX_BATCH);
    const promise = fetchBatch(slice)
      .catch((err) => {
        console.warn("[storm] cell env fetch failed", err);
        // Negativ-Cache, damit wir nicht in einer Schleife retryen.
        const now2 = Date.now();
        slice.forEach((k) => {
          if (!cache.has(k)) {
            cache.set(k, { cape: null, liftedIndex: null, validFor: null, fetchedAt: now2 });
          }
        });
      })
      .finally(() => {
        slice.forEach((k) => inflight.delete(k));
      });
    slice.forEach((k) => inflight.set(k, promise));
  }

  // Auf alle relevanten in-flight Requests warten (inkl. parallel ausgelöster).
  const waits = keys.map((k) => inflight.get(k)).filter(Boolean) as Promise<void>[];
  if (waits.length) await Promise.allSettled(waits);

  const out = new Map<string, CellEnvSample>();
  for (const k of keys) {
    const hit = cache.get(k);
    if (hit) out.set(k, hit);
  }
  return out;
}

export function resetCellEnvironmentCache() {
  cache.clear();
  inflight.clear();
}
