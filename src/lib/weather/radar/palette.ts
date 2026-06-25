/**
 * Klassifizierung der DWD-WMS-RY-Pixel auf eine 0..6-Intensitätsstufe.
 *
 * RADOLAN-RY ist ein NIEDERSCHLAGSRATE-Produkt (mm/5min, also Niederschlags-
 * menge je 5 min), KEIN dBZ-Reflektivitätscomposite. Die WMS-Default-Styles
 * färben diese Rate kategorial ein (blau → grün → gelb → orange → rot →
 * violett). Wir klassifizieren über Hue + Lightness, statt RGB-Werte exakt
 * zu matchen — robust gegen PNG-Kompression und kleine Style-Variationen.
 *
 * Stufen sind eine Näherung der DWD-RY-Farbskala. Die mm/h-Repräsentativ-
 * werte unten sind grobe Stützpunkte für konvektiven Niederschlag — keine
 * exakte Farbtabelle. Quelle muss perspektivisch via WMS GetLegendGraphic
 * verifiziert werden.
 */
import { rainRateToDbz } from "./zr";

export type IntensityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Repräsentative Niederschlagsrate (mm/h) je Intensitätsstufe.
 * Grobe Näherung der DWD-RY-Farbskala (leicht → extrem).
 */
export const RATE_FOR_LEVEL: Record<IntensityLevel, number> = {
  0: 0,
  1: 0.5,
  2: 2,
  3: 10,
  4: 25,
  5: 50,
  6: 100,
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
export const CELL_MIN_LEVEL: IntensityLevel = 2; // ≥ ~35 dBZ
export const HAIL_CORE_LEVEL: IntensityLevel = 5; // ≥ ~57 dBZ

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

  // Farbskala der DWD-Styles (zirkulär, beginnend bei Blau ~210°):
  //   Blau (180–250) leicht
  //   Cyan/Grün (90–180) moderat
  //   Gelb (45–90) kräftig
  //   Orange (20–45) stark
  //   Rot (340–360, 0–20) Hagelkern
  //   Violett/Magenta (260–340) extrem
  if (h >= 260 && h <= 340) return 6;
  if (h <= 20 || h >= 340) return 5;
  if (h > 20 && h <= 45) return 4;
  if (h > 45 && h <= 90) return 3;
  if (h > 90 && h <= 180) return 2;
  return 1; // Blau-Bereich
}