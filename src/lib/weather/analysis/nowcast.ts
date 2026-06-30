import type { AlertSeverity, HourlyPoint, MinutelyPoint } from "../types";
import { hailRisk, severeScore } from "./convection";
import { buildNowcast } from "../scoring/nowcast";
import { bandToSeverity } from "../scoring/labels";
import { thunderProbabilityNowcast } from "../scoring/derived";

/**
 * 2-Stunden Nowcast in 10-Minuten-Schritten.
 *
 * Datenbasis:
 *   - Niederschlag und Code aus Open-Meteo `minutely_15` (15-min Raster).
 *   - Konvektive Parameter (CAPE, LI, CIN, Böen, Nullgradgrenze) aus dem
 *     stündlichen Lauf, linear zwischen zwei Stundenstützstellen interpoliert.
 */

export interface NowcastStep {
  time: string;
  minutesFromNow: number;
  precipMmPerH: number;
  precipProb: number;
  thunderProb: number;
  hail: AlertSeverity | "none";
  severeScore: number;
  level: AlertSeverity | "none";
  weatherCode?: number;
  windSpeedMs?: number;
  windGustMs?: number;
  temperatureC?: number;
  capeJkg?: number;
  liftedIndex?: number;
}

export interface Nowcast2h {
  steps: NowcastStep[];
  peakLevel: AlertSeverity | "none";
  peakScore: number;
  peakStep: NowcastStep | null;
  thunderProbMax: number;
  hailMax: AlertSeverity | "none";
  precipMaxMmPerH: number;
  precipSumMm: number;
  headline: string;
  confidence: "niedrig" | "mittel" | "hoch";
}

const SEVERITY_ORDER: Array<AlertSeverity | "none"> = [
  "none",
  "minor",
  "moderate",
  "severe",
  "extreme",
];

export function buildNowcast2h(
  hourly: HourlyPoint[],
  minutely: MinutelyPoint[] | undefined,
  now: Date,
): Nowcast2h {
  const result = buildNowcast({ hourly, minutely, now });
  const STEP_MIN = 10;

  const steps: NowcastStep[] = result.steps.map((s) => {
    const p = s.point;
    const hail = hailRisk(p);
    return {
      time: s.time,
      minutesFromNow: s.minutesFromNow,
      precipMmPerH: p.precipitationMm ?? 0,
      precipProb: p.precipitationProbability ?? 0,
      thunderProb: thunderProbabilityNowcast(p),
      hail,
      severeScore: s.total,
      level: bandToSeverity(s.band),
      weatherCode: s.weatherCode,
      windSpeedMs: p.windSpeedMs,
      windGustMs: p.windGustMs,
      temperatureC: p.temperatureC,
      capeJkg: p.cape,
      liftedIndex: p.liftedIndex,
    };
  });

  const peak = steps.reduce<NowcastStep | null>(
    (best, s) => (!best || s.severeScore > best.severeScore ? s : best),
    null,
  );
  const thunderProbMax = Math.max(0, ...steps.map((s) => s.thunderProb));
  const hailMax = steps.reduce<AlertSeverity | "none">(
    (worst, s) => (SEVERITY_ORDER.indexOf(s.hail) > SEVERITY_ORDER.indexOf(worst) ? s.hail : worst),
    "none",
  );
  const precipMaxMmPerH = Math.max(0, ...steps.map((s) => s.precipMmPerH));
  const precipSumMm = steps.reduce((sum, s) => sum + s.precipMmPerH * (STEP_MIN / 60), 0);
  const confidence = result.confidence;

  return {
    steps,
    peakLevel: peak?.level ?? "none",
    peakScore: peak?.severeScore ?? 0,
    peakStep: peak,
    thunderProbMax,
    hailMax,
    precipMaxMmPerH,
    precipSumMm,
    headline: headlineFor(peak?.level ?? "none", thunderProbMax, precipMaxMmPerH, hailMax),
    confidence,
  };
}

function headlineFor(
  level: AlertSeverity | "none",
  thunderProb: number,
  rainMmPerH: number,
  hail: AlertSeverity | "none",
): string {
  if (level === "extreme") return "Extremes Unwetter im Anmarsch";
  if (hail !== "none" && SEVERITY_ORDER.indexOf(hail) >= 3)
    return "Hagelgefahr in den nächsten 2 Stunden";
  if (level === "severe") return "Schweres Unwetter in den nächsten 2 Stunden möglich";
  if (level === "moderate") return "Markantes Wetter im 2-Stunden-Nowcast";
  if (thunderProb >= 0.5) return "Gewitter im 2-Stunden-Nowcast wahrscheinlich";
  if (rainMmPerH >= 5) return "Schauerstaffel im Anflug";
  if (level === "minor") return "Erhöhte Gewitterneigung in den nächsten 2 Stunden";
  return "Ruhige Kurzfristlage in den nächsten 2 Stunden";
}

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
