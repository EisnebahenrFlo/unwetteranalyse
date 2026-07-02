import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * MeteoAlarm Legacy-Atom-Feeds. Beobachtetes Format (Juli 2026, AT/IT):
 *   Atom-<entry> mit CAP-1.2-Elementen (cap:severity, cap:event, cap:onset,
 *   cap:effective, cap:expires, cap:areaDesc, cap:geocode/EMMA_ID …).
 *   KEINE <cap:polygon>, KEINE <cap:parameter> awareness_type/level.
 *   Hazard-Info steckt im cap:event-Text: "Yellow Thunderstorm Warning" u. ä.
 * Parser ist defensiv: falls Polygone später ergänzt werden, greifen sie.
 */
export interface MeteoAlarmRaw {
  id: string;
  event: string;
  severity: string; // CAP: Minor|Moderate|Severe|Extreme
  onset?: string;
  expires?: string;
  areaDesc?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  awarenessType?: string;
  awarenessLevel?: string;
  polygons: [number, number][][]; // [lon,lat][] je Polygon; leer wenn keine Geometrie
}

const FEED_BASE = "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-";

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

function pick(block: string, tags: string[]): string | undefined {
  for (const t of tags) {
    const m = block.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i"));
    if (m) return decode(m[1]);
  }
  return undefined;
}

/** CAP-Polygon: "lat,lon lat,lon ..." -> [lon,lat][]. */
function parsePolygons(block: string): [number, number][][] {
  const polys: [number, number][][] = [];
  const re = /<(?:cap:)?polygon>([\s\S]*?)<\/(?:cap:)?polygon>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const pts = m[1]
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [la, lo] = pair.split(",").map(Number);
        return [lo, la] as [number, number];
      })
      .filter(([lo, la]) => Number.isFinite(lo) && Number.isFinite(la));
    if (pts.length >= 3) polys.push(pts);
  }
  return polys;
}

export const fetchMeteoAlarm = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ feed: z.string().min(2) }).parse(data))
  .handler(async ({ data }): Promise<MeteoAlarmRaw[]> => {
    try {
      const res = await fetch(`${FEED_BASE}${data.feed}`, {
        headers: {
          "User-Agent": "UnwetterForecastHub/1.0 (+unwetteranalyse.app)",
          Accept: "application/atom+xml,application/xml,text/xml",
        },
      });
      if (!res.ok) return [];
      const xml = await res.text();
      const entries = xml.split(/<entry[\s>]/i).slice(1);
      const out: MeteoAlarmRaw[] = [];
      entries.forEach((block, idx) => {
        const severity = pick(block, ["cap:severity", "severity"]);
        if (!severity) return; // grüne/leere Einträge überspringen
        out.push({
          id: pick(block, ["cap:identifier", "id"]) ?? `ma-${data.feed}-${idx}`,
          event: pick(block, ["cap:event", "event", "title"]) ?? "Wetterwarnung",
          severity,
          onset: pick(block, ["cap:onset", "cap:effective", "onset", "effective", "updated"]),
          expires: pick(block, ["cap:expires", "expires"]),
          areaDesc: pick(block, ["cap:areaDesc", "areaDesc"]),
          headline: pick(block, ["cap:headline", "headline", "title"]),
          description: pick(block, ["cap:description", "summary", "description"]),
          instruction: pick(block, ["cap:instruction", "instruction"]),
          polygons: parsePolygons(block),
        });
      });
      return out;
    } catch {
      return [];
    }
  });
/* ============================================================
 * MeteoGate EDR (GeoJSON, punktgenau via BBox + CAP-XML).
 *
 * Real verifiziertes Schema (Juli 2026):
 *  - Basis-URL: https://api.meteogate.eu/warnings/collections/warnings/locations/{ISO2}
 *  - Pflicht: ?f=GeoJSON&datetime=<from>/<to> (Fenster < 24 h, sent-Zeit).
 *  - Response: FeatureCollection, feature.geometry.type = "Polygon" (BBox als
 *    5-Punkt-Ring), feature.properties enthält KEINE CAP-Details, nur:
 *      alertId, countryCode, hubLanguage, hubTime, hubLink (→ CAP-1.2-XML),
 *      supersededByAlertId (Filter aktiv/veraltet), geometryType ("bbox"),
 *      indexArea/indexFeature/indexInfo, OBJECTID.
 *  - Details (severity, event, onset, expires, areaDesc, headline,
 *    description, instruction, awareness_type/level) stecken in der CAP-XML
 *    unter hubLink. Wir laden die XML pro aktivem Alert nach.
 *
 * Ablauf:
 *  1. GeoJSON-Index laden (24-h-Fenster um jetzt).
 *  2. Features filtern: !supersededByAlertId + BBox enthält Punkt.
 *  3. Dedup nach alertId, cap auf max. 25 XML-Fetches.
 *  4. CAP-XML parsen (bevorzugt <info language="de-*">), MeteoAlarmRaw
 *     mit realer BBox als Polygon zurückgeben.
 *
 * Key ausschließlich server-seitig aus process.env.METEOGATE_API_KEY
 * (oder METEOALARM_API_KEY). Ohne Key: [] → Aufrufer nutzt Legacy-Atom.
 * ============================================================ */
const EDR_BASE = "https://api.meteogate.eu/warnings/collections/warnings/locations/";
const EDR_MAX_ALERTS = 25;
const EDR_WINDOW_MS = 23 * 3600_000; // < 24 h Pflicht

/** GeoJSON-Geometrie -> Liste von [lon,lat][]-Ringen (Polygon + MultiPolygon). */
function geomToRings(geom: unknown): [number, number][][] {
  if (!geom || typeof geom !== "object") return [];
  const g = geom as { type?: string; coordinates?: unknown };
  if (g.type === "Polygon" && Array.isArray(g.coordinates)) {
    return (g.coordinates as number[][][]).map((r) => r as [number, number][]);
  }
  if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
    return (g.coordinates as number[][][][]).flatMap((poly) =>
      poly.map((r) => r as [number, number][]),
    );
  }
  return [];
}

function digitsOnly(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const m = v.match(/\d+/);
  return m?.[0];
}

function bboxContains(ring: [number, number][], lon: number, lat: number): boolean {
  if (ring.length < 4) return false;
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [x, y] of ring) {
    if (x < minLon) minLon = x;
    if (x > maxLon) maxLon = x;
    if (y < minLat) minLat = y;
    if (y > maxLat) maxLat = y;
  }
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

/** CAP <parameter><valueName>X</valueName><value>Y</value></parameter> → Map. */
function capParameters(infoBlock: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<parameter>[\s\S]*?<valueName>([\s\S]*?)<\/valueName>[\s\S]*?<value>([\s\S]*?)<\/value>[\s\S]*?<\/parameter>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(infoBlock))) out[decode(m[1])] = decode(m[2]);
  return out;
}

/** Wähle bevorzugt de-*-<info>-Block, sonst en-*, sonst ersten. */
function pickInfoBlock(xml: string): string | undefined {
  const blocks = xml.split(/<info>/i).slice(1).map((b) => b.split(/<\/info>/i)[0]);
  if (blocks.length === 0) return undefined;
  const langOf = (b: string) => (pick(b, ["language"]) ?? "").toLowerCase();
  return (
    blocks.find((b) => langOf(b).startsWith("de")) ??
    blocks.find((b) => langOf(b).startsWith("en")) ??
    blocks[0]
  );
}

async function fetchCapAlert(
  alertId: string,
  hubLink: string,
  bboxRing: [number, number][],
): Promise<MeteoAlarmRaw | null> {
  try {
    const res = await fetch(hubLink, {
      headers: {
        "User-Agent": "UnwetterForecastHub/1.0 (+unwetteranalyse.app)",
        Accept: "application/xml,text/xml",
      },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const info = pickInfoBlock(xml);
    if (!info) return null;
    const severity = pick(info, ["severity"]);
    if (!severity) return null;
    const params = capParameters(info);
    return {
      id: alertId,
      event: pick(info, ["event"]) ?? "Wetterwarnung",
      severity,
      onset: pick(info, ["onset", "effective"]),
      expires: pick(info, ["expires"]),
      areaDesc: pick(info, ["areaDesc"]),
      headline: pick(info, ["headline"]),
      description: pick(info, ["description"]),
      instruction: pick(info, ["instruction"]),
      awarenessType: digitsOnly(params["awareness_type"]),
      awarenessLevel: digitsOnly(params["awareness_level"]),
      polygons: bboxRing.length ? [bboxRing] : [],
    };
  } catch {
    return null;
  }
}

export const fetchMeteoAlarmEdr = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        country: z.string().length(2),
        lat: z.number(),
        lon: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<MeteoAlarmRaw[]> => {
    const key = process.env.METEOALARM_API_KEY ?? process.env.METEOGATE_API_KEY;
    if (!key) return [];
    try {
      const now = Date.now();
      const from = new Date(now - EDR_WINDOW_MS / 2).toISOString().replace(/\.\d+Z$/, "Z");
      const to = new Date(now + EDR_WINDOW_MS / 2).toISOString().replace(/\.\d+Z$/, "Z");
      const url = `${EDR_BASE}${data.country.toUpperCase()}?f=GeoJSON&datetime=${from}/${to}`;
      const res = await fetch(url, {
        headers: {
          apikey: key,
          Accept: "application/geo+json,application/json",
          "User-Agent": "UnwetterForecastHub/1.0 (+unwetteranalyse.app)",
        },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { features?: unknown[] };
      const features = Array.isArray(json?.features) ? json.features : [];

      // Index filtern: aktiv (nicht superseded) + BBox enthält Punkt.
      const seen = new Set<string>();
      const candidates: Array<{ alertId: string; hubLink: string; ring: [number, number][] }> = [];
      for (const raw of features) {
        const f = raw as {
          properties?: Record<string, unknown>;
          geometry?: unknown;
        };
        const p = f.properties ?? {};
        if (p.supersededByAlertId) continue;
        const alertId = typeof p.alertId === "string" ? p.alertId : null;
        const hubLink = typeof p.hubLink === "string" ? p.hubLink : null;
        if (!alertId || !hubLink) continue;
        const rings = geomToRings(f.geometry);
        const outer = rings[0];
        if (!outer || !bboxContains(outer, data.lon, data.lat)) continue;
        if (seen.has(alertId)) continue;
        seen.add(alertId);
        candidates.push({ alertId, hubLink, ring: outer });
        if (candidates.length >= EDR_MAX_ALERTS) break;
      }

      const settled = await Promise.all(
        candidates.map((c) => fetchCapAlert(c.alertId, c.hubLink, c.ring)),
      );
      return settled.filter((x): x is MeteoAlarmRaw => x !== null);
    } catch {
      return [];
    }
  });
