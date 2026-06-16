/**
 * RainViewer liefert weltweit kostenlos Radar-Tiles.
 * Docs: https://www.rainviewer.com/api.html
 */
export interface RainViewerFrame { time: number; path: string }
export interface RainViewerMaps {
  host: string;
  radar: { past: RainViewerFrame[]; nowcast: RainViewerFrame[] };
}

export async function fetchRainViewerMaps(): Promise<RainViewerMaps> {
  const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
  if (!res.ok) throw new Error(`RainViewer HTTP ${res.status}`);
  return res.json();
}

export function rainviewerTileUrl(host: string, path: string, options?: {
  size?: 256 | 512; color?: number; smooth?: 0 | 1; snow?: 0 | 1;
}) {
  const size = options?.size ?? 256;
  const color = options?.color ?? 4;
  const smooth = options?.smooth ?? 1;
  const snow = options?.snow ?? 1;
  return `${host}${path}/${size}/{z}/{x}/{y}/${color}/${smooth}_${snow}.png`;
}
