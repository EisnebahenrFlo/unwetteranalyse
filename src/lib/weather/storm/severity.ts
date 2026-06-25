import type { StormEnvironment, StormSeverity, StormSeverityBreakdown } from "./types";
import type { DisplayLevel } from "../thresholds/warn-level";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Severity 0..100 aus Radar-Reflektivität + Fläche + Trend + Umgebung.
 *
 * Quellen:
 *  - topDbz: Maximalreflektivität der Zelle (DWD-RY)
 *  - areaKm2 / hailCoreAreaKm2: Größe und Hagelkern
 *  - dbzTrend / areaTrend: Verstärkung/Abschwächung
 *  - env (CAPE, LI): Eskalations-Gate für Stufe 4
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

  score = clamp(Math.round(score), 0, 100);
  let level: StormSeverity =
    score >= 70 ? "severe" : score >= 45 ? "serious" : score >= 22 ? "watch" : "calm";

  // Stufe 4 (extrem) nur mit Umgebungs-Stütze. Ohne Daten Deckel bei severe.
  if (level === "severe") {
    const scoreGate = input.env.source === "region" ? 85 : 80;
    const cape = input.env.cape;
    const li = input.env.liftedIndex;
    const supports = (cape != null && cape >= 2500) || (li != null && li <= -8);
    const hailGate = input.hailCoreAreaKm2 >= 4;
    if (score >= scoreGate && (supports || hailGate)) {
      level = "extreme";
      const parts: string[] = [];
      if (cape != null) parts.push(`CAPE ${Math.round(cape)} J/kg`);
      if (li != null) parts.push(`LI ${li.toFixed(1)}`);
      if (hailGate) parts.push(`Hagelkern ${input.hailCoreAreaKm2.toFixed(0)} km²`);
      reasons.push(`Stufe 4: ${parts.join(" / ")}`);
    }
  }

  if (reasons.length === 0) reasons.push("schwache Aktivität");
  return { score, level, reasons };
}

/** StormSeverity → gemeinsame DWD-Anzeigestufe. */
export const stormToLevel = (s: StormSeverity): DisplayLevel =>
  s === "extreme" ? 4 : s === "severe" ? 3 : s === "serious" ? 2 : s === "watch" ? 1 : 0;