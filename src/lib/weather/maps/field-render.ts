import type { TempField } from "./temperature-field";

// Farbskala 2-m-Temperatur (°C), meteorologisch (kalt blau -> heiss rot).
export const TEMP_STOPS: { t: number; c: [number, number, number] }[] = [
  { t: -20, c: [49, 54, 149] },
  { t: -10, c: [69, 117, 180] },
  { t: 0, c: [116, 173, 209] },
  { t: 5, c: [171, 217, 233] },
  { t: 10, c: [224, 243, 248] },
  { t: 15, c: [255, 255, 191] },
  { t: 20, c: [254, 224, 144] },
  { t: 25, c: [253, 174, 97] },
  { t: 30, c: [244, 109, 67] },
  { t: 35, c: [215, 48, 39] },
  { t: 42, c: [165, 0, 38] },
];

export function tempColor(t: number): [number, number, number] {
  if (Number.isNaN(t)) return [0, 0, 0];
  const s = TEMP_STOPS;
  if (t <= s[0].t) return s[0].c;
  if (t >= s[s.length - 1].t) return s[s.length - 1].c;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i];
    const b = s[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t);
      return [
        Math.round(a.c[0] + f * (b.c[0] - a.c[0])),
        Math.round(a.c[1] + f * (b.c[1] - a.c[1])),
        Math.round(a.c[2] + f * (b.c[2] - a.c[2])),
      ];
    }
  }
  return s[s.length - 1].c;
}

export function sampleField(field: TempField, hourIdx: number, lat: number, lon: number): number {
  const { lats, lons, nLat, nLon, temps } = field;
  const base = hourIdx * nLat * nLon;
  const dLat = lats[1] - lats[0];
  const dLon = lons[1] - lons[0];
  let fy = (lat - lats[0]) / dLat;
  let fx = (lon - lons[0]) / dLon;
  if (fy < 0) fy = 0;
  if (fy > nLat - 1) fy = nLat - 1;
  if (fx < 0) fx = 0;
  if (fx > nLon - 1) fx = nLon - 1;
  const y0 = Math.floor(fy);
  const x0 = Math.floor(fx);
  const y1 = Math.min(nLat - 1, y0 + 1);
  const x1 = Math.min(nLon - 1, x0 + 1);
  const ty = fy - y0;
  const tx = fx - x0;
  const v00 = temps[base + y0 * nLon + x0];
  const v01 = temps[base + y0 * nLon + x1];
  const v10 = temps[base + y1 * nLon + x0];
  const v11 = temps[base + y1 * nLon + x1];
  const top = v00 + (v01 - v00) * tx;
  const bot = v10 + (v11 - v10) * tx;
  return top + (bot - top) * ty;
}

function mercY(latDeg: number): number {
  const r = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}
function invMercY(y: number): number {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

export function fieldDimensions(field: TempField, width = 700): { width: number; height: number } {
  const north = field.lats[field.nLat - 1];
  const south = field.lats[0];
  const lonSpan = field.lons[field.nLon - 1] - field.lons[0];
  const aspect = (mercY(north) - mercY(south)) / ((lonSpan * Math.PI) / 180);
  return { width, height: Math.max(1, Math.round(width * aspect)) };
}

export function fieldCorners(field: TempField): [number, number][] {
  const north = field.lats[field.nLat - 1];
  const south = field.lats[0];
  const west = field.lons[0];
  const east = field.lons[field.nLon - 1];
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

export function drawField(
  canvas: HTMLCanvasElement,
  field: TempField,
  hourIdx: number,
  width = 700,
): void {
  const { width: w, height: h } = fieldDimensions(field, width);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const north = field.lats[field.nLat - 1];
  const south = field.lats[0];
  const west = field.lons[0];
  const east = field.lons[field.nLon - 1];
  const mN = mercY(north);
  const mS = mercY(south);
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let py = 0; py < h; py++) {
    const my = mN + ((py + 0.5) / h) * (mS - mN);
    const lat = invMercY(my);
    for (let px = 0; px < w; px++) {
      const lon = west + ((px + 0.5) / w) * (east - west);
      const t = sampleField(field, hourIdx, lat, lon);
      const idx = (py * w + px) * 4;
      if (Number.isNaN(t)) {
        data[idx + 3] = 0;
      } else {
        const [r, g, b] = tempColor(t);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}