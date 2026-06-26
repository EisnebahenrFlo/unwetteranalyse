/**
 * Klassifizierung der DWD-WMS-RY-Pixel auf eine 0..6-Intensitätsstufe.
 *
 * RADOLAN-RY ist ein Niederschlagshöhen-Produkt: Rohwerte sind mm pro
 * 5-min-Intervall (DWD: „in Niederschlagshöhen umgerechnet"), KEIN dBZ-
 * Reflektivitätscomposite. Die offizielle WMS-SLD verwendet diese
 * 13-stufige Farbskala (mm/5min, verifiziert über GetStyles
 * `dwd:RADOLAN-RY` am 2026-06-26):
 *
 *   0.01–0.02  #fcffc1  hellgelb
 *   0.02–0.05  #fbff5c  gelb
 *   0.05–0.10  #dffc26  gelbgrün
 *   0.10–0.25  #a0d626  grün
 *   0.25–0.50  #45c379  grün-türkis
 *   0.50–1.00  #00d6d8  cyan
 *   1.00–1.50  #11a1d6  hellblau
 *   1.50–2.50  #0702fc  blau
 *   2.50–4.00  #9232b7  violett
 *   4.00–6.00  #da28c6  magenta
 *   6.00–10.0  #e70d0c  rot
 *   ≥ 10.0     #880e0d  dunkelrot
 *
 * Wir klassifizieren über Hue + Lightness statt RGB-Exact-Match — robust
 * gegen PNG-Kompression und kleine Style-Variationen — und fassen die
 * 13 SLD-Bins in 7 Intensitätsstufen (0..6) zusammen. Die mm/h-
 * Stützpunkte in `RATE_FOR_LEVEL` sind die Bin-Obergrenzen × 12, also
 * repräsentative Stundenraten (Annahme: konstante 5-min-Rate). Sie sind
 * weiterhin nur Näherung; eine exakte Stufenkalibrierung müsste die
 * SLD-Intervalle pro Stufe einzeln auswerten.
 */
import { rainRateToDbz } from "./zr";

export type IntensityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Repräsentative Niederschlagsrate (mm/h) je Intensitätsstufe.
 * Abgeleitet aus den SLD-Bins (mm/5min × 12 → mm/h):
 *   1 ≈ ≤0.10 mm/5min   → ~1 mm/h    (hellgelb…gelbgrün, sehr leicht)
 *   2 ≈ 0.10–0.50       → ~6 mm/h    (grün, leicht)
 *   3 ≈ 0.50–1.50       → ~18 mm/h   (cyan/hellblau, moderat)
 *   4 ≈ 1.50–4.00       → ~48 mm/h   (blau/violett, kräftig)
 *   5 ≈ 4.00–10.0       → ~100 mm/h  (magenta/rot, stark)
 *   6 ≈ ≥ 10.0          → ~150 mm/h  (dunkelrot, extrem)
 */
export const RATE_FOR_LEVEL: Record<IntensityLevel, number> = {
  0: 0,
  1: 1,
  2: 6,
  3: 18,
  4: 48,
  5: 100,
  6: 150,
};

/**
 * dBZ je Intensitätsstufe — abgeleitet aus RATE_FOR_LEVEL via Z-R (Aniol).
 * Nicht direkt pflegen, damit Rate und dBZ konsistent bleiben.
 */
export const DBZ_FOR_LEVEL: Record<IntensityLevel, number> = {
  0: rainRateToDbz(RATE_FOR_LEVEL[0]),
  1: rainRateToDbz(RATE_FOR_LEVEL[1]),
  2: rainRateToDbz(RATE_FOR_LEVEL[2]),
  3: rainRateToDbz(RATE_FOR_LEVEL[3]),
  4: rainRateToDbz(RATE_FOR_LEVEL[4]),
  5: rainRateToDbz(RATE_FOR_LEVEL[5]),
  6: rainRateToDbz(RATE_FOR_LEVEL[6]),
};

/** Schwellen für die Zell-Detektion. */
export const CELL_MIN_LEVEL: IntensityLevel = 2; // ≥ ~6 mm/h (grün, leichter Schauer)
/**
 * NÄHERUNGS-„Hagelkern" rein aus RY-Niederschlag (dunkelrot, oberste
 * SLD-Stufe ≥ 10 mm/5min ≈ ≥ 120 mm/h). Das ist KEIN echtes
 * Reflektivitäts-Hagelsignal — RY ist kein dBZ-Composite und Z-R Aniol
 * sättigt unterhalb klassischer Hagelschwellen (~55–60 dBZ). Markiert
 * lediglich den stärksten Niederschlagskern als Hagel-Verdachtsfläche.
 */
export const HAIL_CORE_LEVEL: IntensityLevel = 6;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return [h, s, l];
}

/**
 * Pixel (R, G, B, A) → Intensitätsstufe.
 * Alpha < 32 oder grauer Hintergrund → 0.
 */
export function classifyPixel(r: number, g: number, b: number, a: number): IntensityLevel {
  if (a < 32) return 0;
  const [h, s, l] = rgbToHsl(r, g, b);
  // Sehr blasse / sehr dunkle Pixel = Karten-Reste, ignorieren.
  if (s < 0.18) return 0;
  if (l < 0.12 || l > 0.96) return 0;

  // DWD-RY-Farbskala (verifiziert über GetStyles, siehe Header):
  //   gelb (60°)  →  grün (90–140°)  →  cyan (180°)  →  hellblau (200°)
  //   blau (240°) →  violett (285°)  →  magenta (305°)
  //   rot (~0°, hell)  →  dunkelrot (~0°, L<0.38)
  // Rot (5) ≈ 6–10 mm/5min, Dunkelrot (6) ≥ 10 mm/5min.
  if (h <= 20 || h >= 340) return l < 0.38 ? 6 : 5;
  if (h > 280 && h < 340) return 5; // Magenta
  if (h >= 250 && h <= 280) return 4; // Violett
  if (h >= 210 && h < 250) return 4; // Blau
  if (h >= 185 && h < 210) return 3; // Hellblau
  if (h >= 160 && h < 185) return 3; // Cyan
  if (h >= 80 && h < 160) return 2; // Grün-Töne
  if (h >= 40 && h < 80) return 1; // Gelb / Gelbgrün
  return 1;
}