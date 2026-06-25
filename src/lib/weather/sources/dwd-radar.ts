const DWD_WMS_URL = "https://maps.dwd.de/geoserver/dwd/wms";
const DWD_OWS_URL = "https://maps.dwd.de/geoserver/dwd/ows";
const DWD_RADAR_LAYER = "Niederschlagsradar";
import { parseWmsTimeDimension } from "./wms-capabilities";

export interface DwdRadarFrame {
  time: string;
}

export async function fetchDwdRadarFrames(): Promise<DwdRadarFrame[]> {
  const url = new URL(DWD_OWS_URL);
  url.searchParams.set("service", "WMS");
  url.searchParams.set("version", "1.3.0");
  url.searchParams.set("request", "GetCapabilities");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`DWD Radar HTTP ${res.status}`);

  const text = await res.text();
  const raw = parseWmsTimeDimension(text, DWD_RADAR_LAYER);
  const times = raw ? expandTimeDimension(raw) : [];
  return times.slice(-36).map((time) => ({ time }));
}

export function dwdRadarTileUrl(time?: string) {
  const url = new URL(DWD_WMS_URL);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.1.1");
  url.searchParams.set("REQUEST", "GetMap");
  url.searchParams.set("FORMAT", "image/png");
  url.searchParams.set("TRANSPARENT", "true");
  url.searchParams.set("LAYERS", DWD_RADAR_LAYER);
  url.searchParams.set("STYLES", "");
  url.searchParams.set("SRS", "EPSG:3857");
  url.searchParams.set("WIDTH", "256");
  url.searchParams.set("HEIGHT", "256");
  url.searchParams.set("BBOX", "{bbox-epsg-3857}");
  url.searchParams.set("TIME", time ?? "current");
  return url.toString().replace("%7Bbbox-epsg-3857%7D", "{bbox-epsg-3857}");
}

function expandTimeDimension(raw: string) {
  if (raw.includes(",")) return raw.split(",").map((value) => value.trim()).filter(Boolean);

  const [startRaw, endRaw, stepRaw] = raw.split("/");
  const start = new Date(startRaw).getTime();
  const end = new Date(endRaw).getTime();
  const stepMinutes = Number(stepRaw?.match(/PT(\d+)M/)?.[1] ?? 5);
  const stepMs = stepMinutes * 60_000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || stepMs <= 0) return [];

  const out: string[] = [];
  for (let time = start; time <= end; time += stepMs) out.push(new Date(time).toISOString());
  return out;
}