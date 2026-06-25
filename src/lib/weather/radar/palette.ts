/**
 * Klassifizierung der DWD-WMS-RY-Pixel auf eine 0..6-Intensitätsstufe.
 *
 * Die WMS-Default-Styles färben Niederschlagsraten farblich (blau → grün →
 * gelb → orange → rot → violett). Wir klassifizieren über Hue + Lightness,
 * statt einzelne RGB-Werte exakt zu matchen — das ist robust gegen
 * PNG-Kompression und kleine Style-Variationen.
 *
 * Stufen mapped grob auf:
 *   0 — transparent / Hintergrund
 *   1 — leichter Niederschlag  ~  20–30 dBZ
 *   2 — moderat                ~  30–40 dBZ
 *   3 — kräftig                ~  40–48 dBZ
 *   4 — stark / Gewitter-Kern  ~  48–55 dBZ
 *   5 — Hagelkern              ~  55–60 dBZ
 *   6 — extrem (sehr selten)   ~  >60 dBZ
 */
export type IntensityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** dBZ-Approximation für Severity & Anzeige. */
export const DBZ_FOR_LEVEL: Record<IntensityLevel, number> = {
  0: 0,
  1: 25,
  2: 35,
  3: 42,
  4: 50,
  5: 57,
  6: 62,
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