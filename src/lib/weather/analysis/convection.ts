import type { HourlyPoint, AlertSeverity } from "../types";

/**
 * Konvektions- und Unwetter-Analyse für ForecastHub.
 * Alle Heuristiken sind bewusst nachvollziehbar gehalten und an DWD-
 * orientierten Schwellen + gängiger Gewitter-Diagnose ausgerichtet.
 */

export interface SevereScore {
  /** 0–100, kombinierte Einschätzung Gewitter/Unwetter. */
  value: number;
  level: AlertSeverity | "none";
  reasons: string[];
}

/** Heuristische Gewitter-Wahrscheinlichkeit (0–1). */
export function thunderProbability(p: HourlyPoint): number {
  let prob = 0;
  if (p.cape != null) {
    if (p.cape >= 2500) prob = Math.max(prob, 0.95);
    else if (p.cape >= 1500) prob = Math.max(prob, 0.8);
    else if (p.cape >= 800) prob = Math.max(prob, 0.55);
    else if (p.cape >= 300) prob = Math.max(prob, 0.3);
  }
  if (p.liftedIndex != null) {
    if (p.liftedIndex <= -6) prob = Math.max(prob, 0.9);
    else if (p.liftedIndex <= -3) prob = Math.max(prob, 0.7);
    else if (p.liftedIndex <= -1) prob = Math.max(prob, 0.45);
  }
  // CIN ist positiv in J/kg (Open-Meteo: 0…765); ≥150 = spürbarer Deckel, dämpft.
  if (p.convectiveInhibition != null && p.convectiveInhibition >= 150) prob *= 0.5;
  // WMO-Codes 95–99 sind Gewitter — wenn das Modell sie meldet, hochziehen.
  if (p.weatherCode != null && p.weatherCode >= 95) prob = Math.max(prob, 0.85);
  return Math.min(1, prob);
}

/** Hagel-Risiko: Modellsignal (WMO 96/99) oder CAPE + LI/Freezing-Level-Proxy. */
export function hailRisk(p: HourlyPoint): AlertSeverity | "none" {
  const code = p.weatherCode;
  // Direktes Modellsignal (Mitteleuropa / ICON): Gewitter mit Hagel.
  if (code === 99) return "severe"; // schwerer Hagel
  if (code === 96) return "moderate"; // leichter Hagel
  if (p.cape == null) return "none";
  const li = p.liftedIndex; // nur GFS liefert LI
  const fl = p.freezingLevelM ?? 4000;
  if (li != null) {
    // LI-gestützter Pfad (schärfer, wenn vorhanden)
    if (p.cape >= 2000 && li <= -5 && fl <= 3500) return "severe";
    if (p.cape >= 1500 && li <= -3) return "moderate";
    if (p.cape >= 800 && li <= -2) return "minor";
    return "none";
  }
  // Ohne LI: konservativer CAPE + Freezing-Level-Proxy (deckelt auf moderate).
  if (p.cape >= 2500 && fl <= 3500) return "moderate";
  if (p.cape >= 1500 && fl <= 3800) return "minor";
  return "none";
}

/** Sturmböen-/Downburst-Risiko in der konvektiven Lage. */
export function downburstRisk(p: HourlyPoint): AlertSeverity | "none" {
  const gust = p.windGustMs ?? 0;
  const cape = p.cape ?? 0;
  if (cape >= 1000 && gust >= 25) return "severe";
  if (cape >= 800 && gust >= 20) return "moderate";
  if (cape >= 500 && gust >= 16) return "minor";
  return "none";
}

/** Einfacher Low-Level-Shear-Proxy in m/s aus 10 m vs. 180 m Wind. */
export function lowLevelShearMs(p: HourlyPoint): number | null {
  const a = p.windSpeedMs;
  const b = p.windSpeed180mMs;
  if (a == null || b == null) return null;
  const da = p.windDirection80mDeg ?? p.windDirection180mDeg;
  // Vereinfachung: skalare Differenz; Richtungsanteil als kleiner Bonus.
  let base = Math.abs(b - a);
  if (da != null && p.windDirection80mDeg != null) {
    const diff = Math.abs((((p.windDirection180mDeg ?? da) - da + 540) % 360) - 180);
    base += (diff / 180) * 3; // bis +3 m/s "Richtungs-Shear"
  }
  return base;
}

/** Schwüle / Sultriness aus Taupunkt (°C). */
export function sultriness(p: HourlyPoint): "trocken" | "angenehm" | "schwül" | "drückend" {
  const td = p.dewPointC;
  if (td == null) return "angenehm";
  if (td >= 20) return "drückend";
  if (td >= 16) return "schwül";
  if (td >= 10) return "angenehm";
  return "trocken";
}

/** Kombinierter Severity-Score 0–100 für eine Stunde. */
export function severeScore(p: HourlyPoint): SevereScore {
  let score = 0;
  const reasons: string[] = [];

  const tp = thunderProbability(p);
  if (tp > 0.3) {
    score += tp * 35;
    reasons.push(`Gewitter ${Math.round(tp * 100)} %`);
  }

  const hail = hailRisk(p);
  if (hail !== "none") {
    score += hail === "severe" ? 25 : hail === "moderate" ? 15 : 8;
    reasons.push(`Hagel ${hail}`);
  }

  const dbr = downburstRisk(p);
  if (dbr !== "none") {
    score += dbr === "severe" ? 25 : dbr === "moderate" ? 15 : 8;
    reasons.push(`Sturmböen ${dbr}`);
  }

  const rain = p.precipitationMm ?? 0;
  if (rain >= 40) {
    score += 30;
    reasons.push("Extremer Starkregen");
  } else if (rain >= 25) {
    score += 22;
    reasons.push("Heftiger Starkregen");
  } else if (rain >= 15) {
    score += 12;
    reasons.push("Starkregen markant");
  }

  const gust = p.windGustMs ?? 0;
  if (gust >= 33) {
    score += 30;
    reasons.push("Orkanböen");
  } else if (gust >= 25) {
    score += 22;
    reasons.push("Schwerer Sturm");
  } else if (gust >= 18) {
    score += 12;
    reasons.push("Sturmböen");
  } else if (gust >= 14) {
    score += 6;
    reasons.push("Windböen");
  }

  score = Math.min(100, Math.round(score));
  const level: SevereScore["level"] =
    score >= 70 ? "severe" : score >= 45 ? "moderate" : score >= 20 ? "minor" : "none";
  return { value: score, level, reasons };
}

export interface HourlySevere {
  time: string;
  score: SevereScore;
  thunderProb: number;
  hail: AlertSeverity | "none";
  downburst: AlertSeverity | "none";
}

export function severeTimeline(hourly: HourlyPoint[], hours = 24): HourlySevere[] {
  return hourly.slice(0, hours).map((p) => ({
    time: p.time,
    score: severeScore(p),
    thunderProb: thunderProbability(p),
    hail: hailRisk(p),
    downburst: downburstRisk(p),
  }));
}

/** Aggregierte 24-h-Einschätzung pro Modell. */
export interface ModelSevereSummary {
  capeMax: number | null;
  liMin: number | null;
  gustMaxMs: number;
  precipMaxMm: number;
  thunderProbMax: number;
  worstScore: number;
  level: AlertSeverity | "none";
}

export function summarizeModelSevere(hourly: HourlyPoint[], hours = 24): ModelSevereSummary {
  const slice = hourly.slice(0, hours);
  const capes = slice.map((h) => h.cape).filter((v): v is number => v != null);
  const lis = slice.map((h) => h.liftedIndex).filter((v): v is number => v != null);
  const gusts = slice.map((h) => h.windGustMs ?? 0);
  const rains = slice.map((h) => h.precipitationMm ?? 0);
  const tps = slice.map(thunderProbability);
  const scores = slice.map((h) => severeScore(h).value);
  const worst = Math.max(0, ...scores);
  return {
    capeMax: capes.length ? Math.max(...capes) : null,
    liMin: lis.length ? Math.min(...lis) : null,
    gustMaxMs: gusts.length ? Math.max(...gusts) : 0,
    precipMaxMm: rains.length ? Math.max(...rains) : 0,
    thunderProbMax: tps.length ? Math.max(...tps) : 0,
    worstScore: worst,
    level: worst >= 70 ? "severe" : worst >= 45 ? "moderate" : worst >= 20 ? "minor" : "none",
  };
}
