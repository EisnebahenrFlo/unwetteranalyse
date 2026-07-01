import type { AlertSeverity, HourlyPoint } from "../types";
import {
  convectionSubscore,
  rainSubscore,
  thunderSubscore,
  windSubscore,
} from "../scoring/subscores";
import { combineToday } from "../scoring/combine";
import { bandFromScore, bandToSeverity } from "../scoring/labels";
import { hailRisk, downburstRisk, hazardBoostFloor } from "../scoring/hazard-axes";
import { thunderProbability as thunderProbabilityFull } from "../scoring/derived";

// Rückwärtskompatible Re-Exports (Signaturen unverändert):
export { hailRisk, downburstRisk } from "../scoring/hazard-axes";
export { lowLevelShearMs } from "../scoring/derived";
export { sultrinessFrom as sultriness } from "../scoring/derived";
// convection.thunderProbability war byte-gleich zur Nowcast-Variante:
export { thunderProbabilityNowcast as thunderProbability } from "../scoring/derived";

export interface SevereScore {
  value: number;
  level: AlertSeverity | "none";
  reasons: string[];
}

/**
 * Kombinierter Severity-Score 0–100 für EINE Stunde.
 * Gleiche Basis wie buildToday (Subscores + combineToday) + Hagel/Downburst-Floor.
 */
export function severeScore(p: HourlyPoint): SevereScore {
  const rain = rainSubscore(p);
  const wind = windSubscore(p);
  const thunder = thunderSubscore(p);
  const conv = convectionSubscore(p);
  const combined = combineToday(rain.value, wind.value, thunder.value, conv.value);
  const value = Math.min(100, Math.max(combined, hazardBoostFloor(p)));
  const band = bandFromScore(value);

  const reasons: string[] = [];
  if (thunder.value >= 35) reasons.push(`Gewitter ${thunder.band}`);
  if (rain.value >= 35) reasons.push(`Regen ${rain.band}`);
  if (wind.value >= 35) reasons.push(`Wind ${wind.band}`);
  if (conv.value >= 35) reasons.push(`Labilität ${conv.band}`);
  const hail = hailRisk(p);
  if (hail !== "none") reasons.push(`Hagel ${hail}`);
  const db = downburstRisk(p);
  if (db !== "none") reasons.push(`Downburst ${db}`);
  if (reasons.length === 0) reasons.push("keine Signale über Schwelle");

  return { value, level: bandToSeverity(band), reasons };
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
    thunderProb: thunderProbabilityFull(p),
    hail: hailRisk(p),
    downburst: downburstRisk(p),
  }));
}

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
  const tps = slice.map(thunderProbabilityFull);
  const scores = slice.map((h) => severeScore(h).value);
  const worst = Math.max(0, ...scores);
  return {
    capeMax: capes.length ? Math.max(...capes) : null,
    liMin: lis.length ? Math.min(...lis) : null,
    gustMaxMs: gusts.length ? Math.max(...gusts) : 0,
    precipMaxMm: rains.length ? Math.max(...rains) : 0,
    thunderProbMax: tps.length ? Math.max(...tps) : 0,
    worstScore: worst,
    level: bandToSeverity(bandFromScore(worst)),
  };
}

/** 24-h-Tagesbewertung (max severeScore) für ein Datum. */
export function dailySeverity(hourly: HourlyPoint[], date: string) {
  const dayPoints = hourly.filter((p) => p.time.slice(0, 10) === date);
  if (dayPoints.length === 0)
    return { level: "none" as AlertSeverity | "none", score: 0, reasons: [] as string[] };
  let best = { level: "none" as AlertSeverity | "none", score: 0, reasons: [] as string[] };
  for (const p of dayPoints) {
    const s = severeScore(p);
    if (s.value > best.score) best = { level: s.level, score: s.value, reasons: s.reasons };
  }
  return best;
}