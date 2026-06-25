import type { StormEnvironment, StormSeverity, StormSeverityBreakdown } from "./types";
import type { DisplayLevel } from "../thresholds/warn-level";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Bft-Stufung der Forecast-Spitzenböe (m/s), analog zu WIND_GUST_RULES:
 *  0 = unter Schwelle
 *  1 = ≥14 m/s  (Bft 7, ~50 km/h, markant)
 *  2 = ≥18 m/s  (Bft 8, Sturmböen)
 *  3 = ≥25 m/s  (Bft 10, schwerer Sturm)
 *  4 = ≥33 m/s  (Bft 12, Orkan)
 */
function windLevelFromMs(ms: number | null | undefined): 0 | 1 | 2 | 3 | 4 {
  if (ms == null || !Number.isFinite(ms)) return 0;
  if (ms >= 33) return 4;
  if (ms >= 25) return 3;
  if (ms >= 18) return 2;
  if (ms >= 14) return 1;
  return 0;
}

/** Mappt eine Wind-Bft-Stufe auf die Mindest-Storm-Stufe (DWD-Maximum-Prinzip). */
function windFloorSeverity(level: 0 | 1 | 2 | 3 | 4): StormSeverity {
  // 4 → "severe" als Deckel; eine echte „extreme"-Hochstufung verlangt
  // dieselbe Umgebungs-Stütze wie für CAPE/LI (siehe extreme-Gate unten).
  if (level === 4) return "severe";
  if (level === 3) return "severe";
  if (level === 2) return "serious";
  if (level === 1) return "watch";
  return "calm";
}

const SEVERITY_ORDER: Record<StormSeverity, number> = {
  calm: 0,
  watch: 1,
  serious: 2,
  severe: 3,
  extreme: 4,
};
function maxSeverity(a: StormSeverity, b: StormSeverity): StormSeverity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

/**
 * Severity 0..100 aus Radar-Reflektivität + Fläche + Trend + Umgebung.
 *
 * Quellen:
 *  - topDbz: Maximalreflektivität der Zelle (DWD-RY)
 *  - areaKm2 / hailCoreAreaKm2: Größe und Hagelkern
 *  - dbzTrend / areaTrend: Verstärkung/Abschwächung
 *  - env (CAPE, LI, Windböen): Wind ist eigenes Kriterium (DWD-Maximum-
 *    Prinzip), CAPE/LI dienen als Eskalations-Gate für Stufe 4
 *
 * Schwellen orientieren sich an den DWD-Unwetterkriterien (>50 dBZ + Hagelkern
 * = markant, >55 dBZ + Wachstum + CAPE-Stütze = extrem).
 */
export function scoreCell(input: {
  topDbz: number;
  hailCoreAreaKm2: number;
  areaKm2: number;
  dbzTrend: number;
  areaTrend: number;
  env: StormEnvironment;
}): StormSeverityBreakdown {
  const reasons: string[] = [];
  let score = 0;

  const dbz = input.topDbz;
  // 35 dBZ → 10 Punkte, 50 dBZ → 40, 60 dBZ → 60.
  const dbzScore = clamp((dbz - 30) * 2, 0, 60);
  score += dbzScore;
  if (dbz >= 50) reasons.push(`Reflektivität ${Math.round(dbz)} dBZ`);
  else if (dbz >= 40) reasons.push(`Reflektivität ${Math.round(dbz)} dBZ`);

  // Größe: ab 30 km² spürbar, ab 200 km² großer Komplex.
  if (input.areaKm2 >= 30) {
    const a = clamp(Math.log10(input.areaKm2 / 10) * 12, 0, 18);
    score += a;
    if (input.areaKm2 >= 100) reasons.push(`Fläche ${Math.round(input.areaKm2)} km²`);
  }

  if (input.hailCoreAreaKm2 >= 1) {
    const h = clamp(input.hailCoreAreaKm2 * 4, 0, 18);
    score += h;
    reasons.push(`Hagelkern ${input.hailCoreAreaKm2.toFixed(0)} km²`);
  }

  if (input.dbzTrend >= 3) {
    score += clamp(input.dbzTrend * 2, 0, 10);
    reasons.push(`verstärkt sich (+${input.dbzTrend.toFixed(0)} dBZ)`);
  } else if (input.dbzTrend <= -3 && dbz < 50) {
    score -= clamp(-input.dbzTrend * 2, 0, 10);
    reasons.push("schwächt ab");
  }

  if (input.areaTrend >= 1.3) {
    score += clamp((input.areaTrend - 1) * 8, 0, 8);
    reasons.push(`wächst ×${input.areaTrend.toFixed(1)}`);
  }

  if (input.env.cape != null) {
    const cape = input.env.cape;
    score += clamp(cape / 100, 0, 18);
    const tag = input.env.source === "cell" ? "lokal" : "Region";
    if (cape >= 1500) reasons.push(`CAPE ${Math.round(cape)} J/kg (${tag})`);
    else if (cape >= 500) reasons.push(`CAPE moderat ${Math.round(cape)} (${tag})`);
  }
  if (input.env.liftedIndex != null) {
    const li = input.env.liftedIndex;
    if (li <= -2) {
      score += clamp(-li * 3, 0, 12);
      const tag = input.env.source === "cell" ? "lokal" : "Region";
      reasons.push(`LI ${li.toFixed(1)} (${tag})`);
    }
  }

  // Wind als eigenes Kriterium (kommt aus Open-Meteo, nicht aus Radar).
  const wLevel = windLevelFromMs(input.env.windGustMs);
  if (wLevel > 0 && input.env.windGustMs != null) {
    const ms = input.env.windGustMs;
    // Additiver Score-Beitrag: 1→6, 2→12, 3→20, 4→28 Punkte.
    const windScore = wLevel === 4 ? 28 : wLevel === 3 ? 20 : wLevel === 2 ? 12 : 6;
    score += windScore;
    const bft = wLevel === 4 ? 12 : wLevel === 3 ? 10 : wLevel === 2 ? 8 : 7;
    reasons.push(`Böen ${(ms * 3.6).toFixed(0)} km/h (Bft ${bft})`);
  }

  score = clamp(Math.round(score), 0, 100);
  let level: StormSeverity =
    score >= 70 ? "severe" : score >= 45 ? "serious" : score >= 22 ? "watch" : "calm";

  // DWD-Maximum-Prinzip: Wind-Kriterium hebt die Stufe an, wenn es höher liegt.
  level = maxSeverity(level, windFloorSeverity(wLevel));

  // Stufe 4 (extrem) nur bei Mehrquellen-Konsens: Radar-Score erreicht das
  // scoreGate UND mindestens eine ECHTE Umgebungs-Stütze (CAPE/LI aus dem
  // Modell ODER Orkanböen aus dem Forecast) liegt vor. Die Hagelkern-Fläche
  // ist eine Farb-Rückrechnung aus dem WMS-Bild — als alleiniger Auslöser
  // für „lebensbedrohlich" zu unsicher. Sie darf nur noch verstärken.
  // (Konsistent zum Wettergefahren-Fusionsprinzip: Multi-Source-Confidence
  // für die höchste Stufe.)
  if (level === "severe") {
    const scoreGate = input.env.source === "region" ? 85 : 80;
    const cape = input.env.cape;
    const li = input.env.liftedIndex;
    const gust = input.env.windGustMs;
    const capeSupport = cape != null && cape >= 2500;
    const liSupport = li != null && li <= -8;
    const windSupport = gust != null && gust >= 33;
    const envSupport = capeSupport || liSupport || windSupport;
    const hailBoost = input.hailCoreAreaKm2 >= 4;
    if (score >= scoreGate && envSupport) {
      level = "extreme";
      const parts: string[] = [];
      if (capeSupport && cape != null) parts.push(`CAPE ${Math.round(cape)} J/kg`);
      if (liSupport && li != null) parts.push(`LI ${li.toFixed(1)}`);
      if (windSupport && gust != null)
        parts.push(`Orkanböen ${(gust * 3.6).toFixed(0)} km/h`);
      if (hailBoost) parts.push(`Hagelkern ${input.hailCoreAreaKm2.toFixed(0)} km²`);
      reasons.push(`Stufe 4: ${parts.join(" / ")}`);
    }
  }

  if (reasons.length === 0) reasons.push("schwache Aktivität");
  return { score, level, reasons };
}

/** StormSeverity → gemeinsame DWD-Anzeigestufe. */
export const stormToLevel = (s: StormSeverity): DisplayLevel =>
  s === "extreme" ? 4 : s === "severe" ? 3 : s === "serious" ? 2 : s === "watch" ? 1 : 0;