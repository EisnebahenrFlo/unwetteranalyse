/**
 * DWD GeoServer WMS Layer für das Radar-Cockpit.
 * Alles kostenfrei, keine Auth.
 * Capabilities: https://maps.dwd.de/geoserver/dwd/ows?service=WMS&request=GetCapabilities
 */
const DWD_OWS = "https://maps.dwd.de/geoserver/dwd/ows";
const DWD_WMS = "https://maps.dwd.de/geoserver/dwd/wms";
import { parseWmsTimeDimension } from "./wms-capabilities";

export type WmsLayerKey = "ry" | "wn";

interface WmsLayerDef {
  /** WMS-Layer-Name laut Capabilities. */
  name: string;
  /** Anzeigename in UI. */
  label: string;
  /** Kurzbeschreibung. */
  blurb: string;
  /** Erwarteter Frame-Abstand in Minuten (für Lücken-Erkennung). */
  stepMinutes: number;
  /** Maximale Frame-Anzahl, die wir aus der Timeline halten. */
  maxFrames: number;
}

export const WMS_LAYERS: Record<WmsLayerKey, WmsLayerDef> = {
  ry: {
    name: "RADOLAN-RY",
    label: "RY",
    blurb: "Beobachtete Niederschlagsanalyse, 5 min, 1 km, Deutschland.",
    stepMinutes: 5,
    maxFrames: 36,
  },
  wn: {
    name: "Radar_wn-product_1x1km_ger",
    label: "WN",
    blurb: "Radar-Nowcast bis +2 h, 5 min, 1 km.",
    stepMinutes: 5,
    maxFrames: 24,
  },
};

export interface WmsTimeline {
  layer: WmsLayerKey;
  frames: string[];
  latest: string | null;
  oldest: string | null;
  stepMs: number;
  /** Verzögerung des letzten Frames gegenüber jetzt (ms), positiv = Frame liegt in Vergangenheit. */
  lagMs: number | null;
  /** Erkannte Frame-Lücken (Anzahl fehlender Steps). */
  gaps: number;
  fetchedAt: string;
}

/**
 * Holt aus den WMS-Capabilities die Time-Dimension für einen Layer.
 * Bewusst ein einziger GetCapabilities-Call pro Layer, gecached durch React Query.
 */
export async function fetchWmsTimeline(layer: WmsLayerKey): Promise<WmsTimeline> {
  const def = WMS_LAYERS[layer];
  const url = new URL(DWD_OWS);
  url.searchParams.set("service", "WMS");
  url.searchParams.set("version", "1.3.0");
  url.searchParams.set("request", "GetCapabilities");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`DWD WMS HTTP ${res.status}`);
  const xml = await res.text();

  const raw = parseWmsTimeDimension(xml, def.name);
  const frames = raw ? expandTime(raw).slice(-def.maxFrames) : [];

  const stepMs = def.stepMinutes * 60_000;
  const latest = frames[frames.length - 1] ?? null;
  const oldest = frames[0] ?? null;
  const lagMs = latest ? Date.now() - new Date(latest).getTime() : null;

  // Lücken: vergleicht tatsächliche vs. erwartete Frame-Anzahl.
  let gaps = 0;
  if (frames.length >= 2 && latest && oldest) {
    const span = new Date(latest).getTime() - new Date(oldest).getTime();
    const expected = Math.round(span / stepMs) + 1;
    gaps = Math.max(0, expected - frames.length);
  }

  return {
    layer,
    frames,
    latest,
    oldest,
    stepMs,
    lagMs,
    gaps,
    fetchedAt: new Date().toISOString(),
  };
}

export function wmsTileUrl(layer: WmsLayerKey, time?: string | null) {
  const def = WMS_LAYERS[layer];
  const url = new URL(DWD_WMS);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.1.1");
  url.searchParams.set("REQUEST", "GetMap");
  url.searchParams.set("FORMAT", "image/png");
  url.searchParams.set("TRANSPARENT", "true");
  url.searchParams.set("LAYERS", def.name);
  // STYLES leer = GeoServer-Default-Style. Die Farbskala-Annahme in
  // src/lib/weather/radar/palette.ts hängt davon ab. TODO: echte Farbskala
  // via WMS GetCapabilities / GetLegendGraphic verifizieren:
  //   https://maps.dwd.de/geoserver/dwd/ows?service=WMS&request=GetCapabilities
  url.searchParams.set("STYLES", "");
  url.searchParams.set("SRS", "EPSG:3857");
  url.searchParams.set("WIDTH", "256");
  url.searchParams.set("HEIGHT", "256");
  url.searchParams.set("BBOX", "{bbox-epsg-3857}");
  if (time) url.searchParams.set("TIME", time);
  return url.toString().replace("%7Bbbox-epsg-3857%7D", "{bbox-epsg-3857}");
}

/** Expand WMS time dimension (comma list or ISO start/end/PTxM). */
function expandTime(raw: string): string[] {
  if (raw.includes(","))
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  const [startRaw, endRaw, stepRaw] = raw.split("/");
  const start = new Date(startRaw).getTime();
  const end = new Date(endRaw).getTime();
  const stepMinutes = Number(stepRaw?.match(/PT(\d+)M/)?.[1] ?? 5);
  const stepMs = stepMinutes * 60_000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || stepMs <= 0) return [];
  const out: string[] = [];
  for (let t = start; t <= end; t += stepMs) out.push(new Date(t).toISOString());
  return out;
}
