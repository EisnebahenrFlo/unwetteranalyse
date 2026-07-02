import { createServerFn } from "@tanstack/react-start";

/**
 * ESTOFEX Convective Outlook (offizielles Storm-Forecast-XML).
 * Reales Schema (Juli 2026, `showforecast.cgi?xml=yes`):
 *   <forecast>
 *     <forecast_type>Storm Forecast</forecast_type>
 *     <start_time value="YYYYMMDDHH"/>
 *     <expiry_time value="YYYYMMDDHH"/>
 *     <issue_time value="YYYYMMDDHHMM"/>
 *     <forecaster>NAME</forecaster>
 *     <domain>EURO</domain>
 *     <text>...Volltext mit <BR>-Trennern...</text>
 *     <area risktype="level 1|level 2|level 3|15thunder|50thunder|severe storms unlikely">
 *       <point lat="X" lon="Y"/>...
 *     </area>
 *     <marker type="..." lat="X" lon="Y"/>
 *   </forecast>
 * Koordinaten explizit als lat/lon-Attribute (Grad, WGS84).
 * Lizenz CC BY-NC-SA 3.0 — Attribution wird in der UI erzwungen.
 */
export interface EstofexForecast {
  issuedAt?: string; // ISO
  validFrom?: string; // ISO
  validTo?: string; // ISO
  forecaster?: string;
  text?: string;
  levels: Array<{ level: 1 | 2 | 3; rings: [number, number][][] }>;
}

const ESTOFEX_URL = "https://www.estofex.org/cgi-bin/polygon/showforecast.cgi?xml=yes";

function attr(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m?.[1];
}

function tagText(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1];
}

/** "YYYYMMDDHH" (10) oder "YYYYMMDDHHMM" (12) -> ISO-UTC. */
function parseStamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const s = value.trim();
  if (!/^\d{10}$|^\d{12}$/.test(s)) return undefined;
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  const h = Number(s.slice(8, 10));
  const mi = s.length === 12 ? Number(s.slice(10, 12)) : 0;
  const t = Date.UTC(y, mo, d, h, mi, 0);
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toISOString();
}

function normalizeText(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw
    .replace(/<BR\s*\/?>(\s*)/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseLevel(risktype: string | undefined): 1 | 2 | 3 | null {
  if (!risktype) return null;
  const m = risktype.trim().toLowerCase().match(/^level\s*([123])$/);
  return m ? (Number(m[1]) as 1 | 2 | 3) : null;
}

function parsePoints(areaBlock: string): [number, number][] {
  const pts: [number, number][] = [];
  const re = /<point\b[^/]*\/>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(areaBlock))) {
    const lat = Number(attr(m[0], "lat"));
    const lon = Number(attr(m[0], "lon"));
    if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push([lon, lat]);
  }
  return pts;
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const [x0, y0] = ring[0];
  const [xn, yn] = ring[ring.length - 1];
  return x0 === xn && y0 === yn ? ring : [...ring, [x0, y0]];
}

export const fetchEstofex = createServerFn({ method: "GET" }).handler(
  async (): Promise<EstofexForecast> => {
    try {
      const res = await fetch(ESTOFEX_URL, {
        headers: {
          "User-Agent": "UnwetterForecastHub/1.0 (+unwetteranalyse.app)",
          Accept: "application/xml,text/xml,*/*",
        },
      });
      if (!res.ok) return { levels: [] };
      const xml = await res.text();

      const issuedAt = parseStamp(attr(xml.match(/<issue_time\b[^/]*\/>/i)?.[0] ?? "", "value"));
      const validFrom = parseStamp(attr(xml.match(/<start_time\b[^/]*\/>/i)?.[0] ?? "", "value"));
      const validTo = parseStamp(attr(xml.match(/<expiry_time\b[^/]*\/>/i)?.[0] ?? "", "value"));
      const forecaster = tagText(xml, "forecaster")?.trim();
      const text = normalizeText(tagText(xml, "text"));

      // Level-Areas gruppieren (identische risktype-Level werden vereint).
      const buckets = new Map<1 | 2 | 3, [number, number][][]>();
      const areaRe = /<area\b([^>]*)>([\s\S]*?)<\/area>/gi;
      let m: RegExpExecArray | null;
      while ((m = areaRe.exec(xml))) {
        const risktype = attr(m[1], "risktype");
        const level = parseLevel(risktype);
        if (!level) continue;
        const pts = parsePoints(m[2]);
        if (pts.length < 3) continue;
        const ring = closeRing(pts);
        const list = buckets.get(level) ?? [];
        list.push(ring);
        buckets.set(level, list);
      }

      const levels: EstofexForecast["levels"] = [];
      for (const lvl of [1, 2, 3] as const) {
        const rings = buckets.get(lvl);
        if (rings && rings.length > 0) levels.push({ level: lvl, rings });
      }

      return { issuedAt, validFrom, validTo, forecaster, text, levels };
    } catch {
      return { levels: [] };
    }
  },
);