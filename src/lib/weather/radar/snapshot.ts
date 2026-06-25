/**
 * Radar-Snapshot aus dem DWD-WMS.
 *
 * Wir holen ein einzelnes RY-Composite-Bild für ein Großraum-BBox (DACH +
 * Italien), decodieren die Pixel via Canvas und detektieren konvektive Zellen
 * über Threshold + Connected-Component-Labeling. Anschließend werden Pixel-
 * Koordinaten zurück in Lon/Lat projiziert (EPSG:3857 Mercator).
 *
 * Eine einzige Map-Anfrage pro Tick (~ 1024×1024 px) ersetzt sowohl den
 * Blitzortung-WebSocket als auch das clusterbasierte DBSCAN.
 */

import { wmsTileUrl } from "@/lib/weather/sources/dwd-wms";
import { classifyPixel, DBZ_FOR_LEVEL } from "./palette";
import { detectCells } from "./cell-detect";

/** Großraum-Detektionsbereich: DACH + Italien, in Lon/Lat. */
export const DETECTION_BBOX_LL = {
  west: 5.5,
  south: 35.5,
  east: 19.0,
  north: 55.8,
} as const;

const WIDTH = 1024;
const HEIGHT = 1024;

export interface RadarCell {
  centroid: { lat: number; lon: number };
  /** Konvexe Hülle in Lon/Lat. */
  polygon: Array<[number, number]>;
  /** Approximative Fläche in km² (Pixel × Pixel-Fläche). */
  areaKm2: number;
  /** Top-Reflektivität in dBZ (kalibriert via Palette). */
  topDbz: number;
  /** Pixelzahl im Hagelkern (≥57 dBZ). */
  hailCorePixels: number;
  /** Hagelkern-Fläche in km². */
  hailCoreAreaKm2: number;
  /** Charakteristischer Radius (sqrt(area/π)) in km. */
  radiusKm: number;
}

export interface RadarSnapshot {
  /** Zeitstempel des verarbeiteten Frames (ISO). */
  frameTime: string;
  /** Wann der Snapshot lokal berechnet wurde. */
  fetchedAt: number;
  cells: RadarCell[];
  /** BBox als [west, south, east, north]. */
  bbox: [number, number, number, number];
}

/* ---------- EPSG:3857 ↔ Lon/Lat ---------- */

const ORIGIN = 6378137 * Math.PI; // Halb-Umfang
function lonToMx(lon: number) {
  return (lon * ORIGIN) / 180;
}
function latToMy(lat: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  return (6378137 * Math.log((1 + sin) / (1 - sin))) / 2;
}
function mxToLon(mx: number) {
  return (mx / ORIGIN) * 180;
}
function myToLat(my: number) {
  return ((2 * Math.atan(Math.exp(my / 6378137)) - Math.PI / 2) * 180) / Math.PI;
}

function bboxMercator() {
  return {
    west: lonToMx(DETECTION_BBOX_LL.west),
    east: lonToMx(DETECTION_BBOX_LL.east),
    south: latToMy(DETECTION_BBOX_LL.south),
    north: latToMy(DETECTION_BBOX_LL.north),
  };
}

/** Pixel(x, y) → Lon/Lat. Pixel-Y ist von oben gemessen, Mercator-Y von unten. */
function pixelToLonLat(x: number, y: number): { lat: number; lon: number } {
  const merc = bboxMercator();
  const mx = merc.west + ((x + 0.5) / WIDTH) * (merc.east - merc.west);
  const my = merc.north - ((y + 0.5) / HEIGHT) * (merc.north - merc.south);
  return { lat: myToLat(my), lon: mxToLon(mx) };
}

/** Pixel-Fläche in km² am Centroid (Mercator-Verzerrung berücksichtigen). */
function pixelKm2At(lat: number): number {
  const merc = bboxMercator();
  const mxPerPx = (merc.east - merc.west) / WIDTH;
  const myPerPx = (merc.north - merc.south) / HEIGHT;
  // Scale-Faktor des Mercators: 1/cos(lat).
  const k = Math.cos((lat * Math.PI) / 180);
  const realMxPerPx = mxPerPx * k;
  const realMyPerPx = myPerPx * k;
  return (realMxPerPx * realMyPerPx) / 1_000_000;
}

function wmsImageUrl(frameTime: string | null) {
  const merc = bboxMercator();
  const bbox = `${merc.west.toFixed(0)},${merc.south.toFixed(0)},${merc.east.toFixed(0)},${merc.north.toFixed(0)}`;
  const tpl = wmsTileUrl("ry", frameTime ?? undefined);
  // tpl enthält den Platzhalter {bbox-epsg-3857}. Wir ersetzen außerdem WIDTH/HEIGHT auf 1024.
  return tpl
    .replace("{bbox-epsg-3857}", bbox)
    .replace(/WIDTH=256/i, `WIDTH=${WIDTH}`)
    .replace(/HEIGHT=256/i, `HEIGHT=${HEIGHT}`);
}

/** Lädt das WMS-Bild und liefert ImageData zurück (clientseitig via Canvas). */
async function loadImageData(url: string): Promise<ImageData> {
  if (typeof window === "undefined") throw new Error("snapshot: window required");
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("radar image load failed"));
    i.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas 2d unavailable");
  ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
  return ctx.getImageData(0, 0, WIDTH, HEIGHT);
}

/** Voller Snapshot: WMS-Frame laden, klassifizieren, Zellen detektieren. */
export async function fetchRadarSnapshot(frameTime: string | null = null): Promise<RadarSnapshot> {
  const url = wmsImageUrl(frameTime);
  const img = await loadImageData(url);
  const mask = new Uint8Array(WIDTH * HEIGHT);
  const data = img.data;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    mask[p] = classifyPixel(data[i], data[i + 1], data[i + 2], data[i + 3]);
  }
  const pixelCells = detectCells(mask, WIDTH, HEIGHT, 8);

  const cells: RadarCell[] = pixelCells.map((pc) => {
    const centroid = pixelToLonLat(pc.cx, pc.cy);
    const pxKm2 = pixelKm2At(centroid.lat);
    const polygon = pc.polygon.map(([x, y]) => {
      const ll = pixelToLonLat(x, y);
      return [ll.lon, ll.lat] as [number, number];
    });
    const areaKm2 = pc.pixels * pxKm2;
    return {
      centroid,
      polygon,
      areaKm2,
      topDbz: DBZ_FOR_LEVEL[pc.topLevel],
      hailCorePixels: pc.hailCorePixels,
      hailCoreAreaKm2: pc.hailCorePixels * pxKm2,
      radiusKm: Math.sqrt(areaKm2 / Math.PI),
    };
  });

  return {
    frameTime: frameTime ?? new Date().toISOString(),
    fetchedAt: Date.now(),
    cells,
    bbox: [
      DETECTION_BBOX_LL.west,
      DETECTION_BBOX_LL.south,
      DETECTION_BBOX_LL.east,
      DETECTION_BBOX_LL.north,
    ],
  };
}