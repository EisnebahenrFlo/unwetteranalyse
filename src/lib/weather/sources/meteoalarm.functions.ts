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