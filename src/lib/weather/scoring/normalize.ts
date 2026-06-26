/**
 * Lineare/abschnittsweise Normalisierung roher Messwerte auf 0–100.
 */

export function clamp(value: number, min = 0, max = 100): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function piecewise(x: number, points: Array<[number, number]>): number {
  if (Number.isNaN(x)) return 0;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return 0;
}

export const normRainMmH = (mm: number) =>
  piecewise(mm, [
    [0, 0],
    [0.5, 8],
    [2.5, 22],
    [10, 45],
    [15, 60],
    [25, 78],
    [40, 92],
    [60, 100],
  ]);

export const normGustKmh = (kmh: number) =>
  piecewise(kmh, [
    [0, 0],
    [40, 10],
    [50, 25],
    [65, 50],
    [80, 70],
    [100, 85],
    [120, 100],
  ]);

export const normWindKmh = (kmh: number) =>
  piecewise(kmh, [
    [0, 0],
    [20, 8],
    [40, 25],
    [60, 50],
    [80, 75],
    [100, 100],
  ]);

export const normCape = (jkg: number) =>
  piecewise(jkg, [
    [0, 0],
    [300, 12],
    [800, 30],
    [1500, 55],
    [2500, 80],
    [4000, 100],
  ]);

export const normLiftedIndex = (li: number) =>
  piecewise(li, [
    [4, 0],
    [0, 10],
    [-1, 22],
    [-3, 45],
    [-5, 70],
    [-7, 88],
    [-10, 100],
  ]);

export const normKIndex = (k: number) =>
  piecewise(k, [
    [0, 0],
    [20, 15],
    [25, 30],
    [30, 50],
    [35, 70],
    [40, 88],
    [45, 100],
  ]);

export const normTotalTotals = (tt: number) =>
  piecewise(tt, [
    [0, 0],
    [40, 10],
    [44, 25],
    [48, 45],
    [50, 60],
    [55, 82],
    [60, 100],
  ]);

export const normThunderProb = (p: number) => clamp(p * 100);

export const normRadarDbz = (mmh: number) => normRainMmH(mmh);

/**
 * CIN-Dämpfung. Open-Meteo liefert convective_inhibition als POSITIVEN Wert
 * in J/kg (0…~765). Höhere Zahl = stärkerer Deckel = stärkere Dämpfung.
 */
export function cinDamping(cin: number | undefined): number {
  if (cin == null) return 1;
  if (cin >= 200) return 0.5;
  if (cin >= 100) return 0.7;
  if (cin >= 50) return 0.85;
  return 1;
}