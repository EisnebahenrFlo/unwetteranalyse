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
 * MeteoGate EDR (GeoJSON, punktgenau via Geometrie/BBox).
 * Amtliche EUMETNET-API. Key ausschließlich server-seitig aus
 * process.env.METEOGATE_API_KEY (oder METEOALARM_API_KEY).
 * Ohne Key: leeres Array -> Aufrufer fällt auf Legacy-Atom zurück.
 * Feldnamen defensiv nach EDR/CAP-1.2 abgeleitet; falls die reale
 * MeteoGate-Response abweichende Properties liefert, greift der
 * String/Sprach-Extraktor `langValue` und der Awareness-Fallback.
 * ============================================================ */
const EDR_BASE = "https://api.meteogate.eu/warnings/edr/v1/collections/warnings/locations/";

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

/** Mehrsprachige Property de>en>erste (String | Array<{lang,value}> | Record<lang,string>). */
function langValue(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const pick =
      v.find((x) => typeof x?.lang === "string" && x.lang.startsWith("de")) ??
      v.find((x) => typeof x?.lang === "string" && x.lang.startsWith("en")) ??
      v[0];
    if (pick == null) return undefined;
    if (typeof pick === "string") return pick;
    return pick.value ?? pick.text ?? undefined;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const val = o.de ?? o.en ?? Object.values(o)[0];
    return typeof val === "string" ? val : undefined;
  }
  return undefined;
}

function digitsOnly(v: unknown): string | undefined {
  if (v == null) return undefined;
  const m = String(v).match(/\d+/);
  return m?.[0];
}

export const fetchMeteoAlarmEdr = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ country: z.string().length(2) }).parse(data))
  .handler(async ({ data }): Promise<MeteoAlarmRaw[]> => {
    const key = process.env.METEOALARM_API_KEY ?? process.env.METEOGATE_API_KEY;
    if (!key) return [];
    try {
      const res = await fetch(
        `${EDR_BASE}${data.country.toUpperCase()}?f=application/geo+json`,
        {
          headers: {
            apikey: key,
            Accept: "application/geo+json,application/json",
            "User-Agent": "UnwetterForecastHub/1.0 (+unwetteranalyse.app)",
          },
        },
      );
      if (!res.ok) return [];
      const json = (await res.json()) as { features?: unknown[] };
      const features = Array.isArray(json?.features) ? json.features : [];
      return features.map((raw, idx) => {
        const f = raw as { id?: unknown; properties?: Record<string, unknown>; geometry?: unknown };
        const p = f.properties ?? {};
        return {
          id: String(f.id ?? p.identifier ?? `edr-${data.country}-${idx}`),
          event:
            langValue(p.event) ??
            langValue(p.eventType) ??
            langValue(p.headline) ??
            "Wetterwarnung",
          severity: String(p.severity ?? "Moderate"),
          onset:
            (p.onset as string | undefined) ??
            (p.effective as string | undefined) ??
            (p.sent as string | undefined),
          expires: p.expires as string | undefined,
          areaDesc: langValue(p.areaDesc) ?? langValue(p.area),
          headline: langValue(p.headline),
          description: langValue(p.description),
          instruction: langValue(p.instruction),
          awarenessType: digitsOnly(p.awareness_type ?? p.awarenessType),
          awarenessLevel: digitsOnly(p.awareness_level ?? p.awarenessLevel),
          polygons: geomToRings(f.geometry),
        } satisfies MeteoAlarmRaw;
      });
    } catch {
      return [];
    }
  });
