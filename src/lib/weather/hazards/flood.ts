/**
 * Sturzflut-Diagnose aus Open-Meteo-Niederschlag.
 *
 * Idee:
 *  - 1 h / 3 h / 6 h / 24 h Niederschlagssummen am Zellort (oder Favoritort).
 *  - Vergleich mit klimatologischen Schwellen, die grob den
 *    KOSTRA-Wiederkehrzeiten T = 1 / 10 / 30 / 100 a für Mittel-Europa
 *    entsprechen. Bewusst konservativ und transparent.
 *  - FFI (Flash-Flood-Index) 0..100 aggregiert das schlimmste Fenster.
 *
 * Echte KOSTRA-Rasterdaten kommen in v2; v1 nutzt eine deterministische,
 * räumlich invariante Skala plus einen optionalen Topo-Faktor.
 */

import type { FloodDiagnosis, HazardLevel, HazardSource } from "./types";

export interface FloodInput {
  /** Niederschlagssummen (mm) in den jeweiligen Fenstern. */
  rrH1: number | null;
  rrH3: number | null;
  rrH6: number | null;
  rrH24: number | null;
  /** Optionaler Topo-Faktor (1..1.5) für Steillagen oder kleine Einzugsgebiete. */
  topoFactor?: number;
  /** Modell-Stunde, auf die sich die Werte beziehen. */
  validFor?: string;
}

/**
 * Schwellen in mm pro Wiederkehrzeit (T = 1, 10, 30, 100 a), grob für
 * Mittel-Europa-Tiefland. Steillagen werden über topoFactor angehoben.
 * Quelle der Größenordnungen: KOSTRA-DWD 2020 Aggregat (publiziert).
 */
const THRESHOLDS_MM: Record<
  "h1" | "h3" | "h6" | "h24",
  { t1: number; t10: number; t30: number; t100: number }
> = {
  h1: { t1: 15, t10: 30, t30: 40, t100: 55 },
  h3: { t1: 22, t10: 45, t30: 60, t100: 80 },
  h6: { t1: 30, t10: 55, t30: 75, t100: 100 },
  h24: { t1: 45, t10: 80, t30: 110, t100: 150 },
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function returnYearsFor(mm: number, win: "h1" | "h3" | "h6" | "h24"): number | null {
  const t = THRESHOLDS_MM[win];
  if (mm < t.t1) return null;
  if (mm >= t.t100) return 100;
  if (mm >= t.t30) return 30;
  if (mm >= t.t10) return 10;
  return 1;
}

/** Score-Anteil pro Fenster: 0 unter T=1a, 100 ab T=100a. */
function windowScore(mm: number, win: "h1" | "h3" | "h6" | "h24"): number {
  const t = THRESHOLDS_MM[win];
  if (mm < t.t1) return 0;
  if (mm >= t.t100) return 100;
  if (mm >= t.t30) return 75 + ((mm - t.t30) / (t.t100 - t.t30)) * 25;
  if (mm >= t.t10) return 50 + ((mm - t.t10) / (t.t30 - t.t10)) * 25;
  return 25 + ((mm - t.t1) / (t.t10 - t.t1)) * 25;
}

function levelFor(ffi: number, returnY: number | null): HazardLevel {
  if (returnY != null && returnY >= 100) return "extreme";
  if (ffi >= 75 || (returnY != null && returnY >= 30)) return "high";
  if (ffi >= 50 || (returnY != null && returnY >= 10)) return "elevated";
  if (ffi >= 25 || returnY != null) return "watch";
  return "none";
}

export function diagnoseFlood(input: FloodInput): FloodDiagnosis {
  const topo = clamp(input.topoFactor ?? 1, 1, 1.5);
  const h1 = (input.rrH1 ?? 0) * topo;
  const h3 = (input.rrH3 ?? 0) * topo;
  const h6 = (input.rrH6 ?? 0) * topo;
  const h24 = (input.rrH24 ?? 0) * topo;

  const scores = {
    h1: windowScore(h1, "h1"),
    h3: windowScore(h3, "h3"),
    h6: windowScore(h6, "h6"),
    h24: windowScore(h24, "h24"),
  };
  const ffi = Math.round(Math.max(scores.h1, scores.h3, scores.h6, scores.h24));

  const returns = [
    returnYearsFor(h1, "h1"),
    returnYearsFor(h3, "h3"),
    returnYearsFor(h6, "h6"),
    returnYearsFor(h24, "h24"),
  ].filter((v): v is number => v != null);
  const returnYears = returns.length ? Math.max(...returns) : null;

  const level = levelFor(ffi, returnYears);

  const reasons: string[] = [];
  if (h1 >= THRESHOLDS_MM.h1.t1)
    reasons.push(`1 h ${h1.toFixed(1)} mm (T≈${returnYearsFor(h1, "h1")}a)`);
  if (h3 >= THRESHOLDS_MM.h3.t1)
    reasons.push(`3 h ${h3.toFixed(1)} mm (T≈${returnYearsFor(h3, "h3")}a)`);
  if (h6 >= THRESHOLDS_MM.h6.t1)
    reasons.push(`6 h ${h6.toFixed(1)} mm (T≈${returnYearsFor(h6, "h6")}a)`);
  if (h24 >= THRESHOLDS_MM.h24.t1)
    reasons.push(`24 h ${h24.toFixed(1)} mm (T≈${returnYearsFor(h24, "h24")}a)`);
  if (topo > 1) reasons.push(`Topo-Faktor ×${topo.toFixed(2)} berücksichtigt`);
  if (reasons.length === 0) reasons.push("Niederschlag unter T=1a-Schwelle");

  const sources: HazardSource[] = [
    { label: "Open-Meteo Forecast (Niederschlag)", validFor: input.validFor },
    { label: "KOSTRA-DWD 2020 (vereinfachte Schwellen)" },
  ];

  return {
    kind: "flood",
    level,
    score: ffi,
    reasons,
    sources,
    rrMm: { h1, h3, h6, h24 },
    returnYears,
    ffi,
  };
}
