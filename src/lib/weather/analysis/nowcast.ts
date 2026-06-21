import type { AlertSeverity, HourlyPoint, MinutelyPoint } from "../types";
import { hailRisk, severeScore, thunderProbability } from "./convection";

/**
 * 2-Stunden Nowcast in 10-Minuten-Schritten.
 *
 * Datenbasis:
 *   - Niederschlag und Code aus Open-Meteo `minutely_15` (15-min Raster).
 *   - Konvektive Parameter (CAPE, LI, CIN, Böen, Nullgradgrenze) aus dem
 *     stündlichen Lauf, linear zwischen zwei Stundenstützstellen interpoliert.
 */

const STEP_MINUTES = 10;
const STEPS = 12; // 12 × 10 min = 2 h

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

const SEVERITY_ORDER: Array<AlertSeverity | "none"> = ["none", "minor", "moderate", "severe", "extreme"];

export function buildNowcast2h(hourly: HourlyPoint[], minutely: MinutelyPoint[] | undefined, now: Date): Nowcast2h {
  const t0 = floorTo(now, STEP_MINUTES);
  const minutelySorted = (minutely ?? []).filter((m) => m.time).slice().sort((a, b) => a.time.localeCompare(b.time));
  const hourlySorted = hourly.slice().sort((a, b) => a.time.localeCompare(b.time));

  const steps: NowcastStep[] = [];
  for (let i = 0; i < STEPS; i++) {
    const t = new Date(t0.getTime() + i * STEP_MINUTES * 60_000);
    const interp = interpolateHourly(hourlySorted, t);
    const minute = findMinutely(minutelySorted, t);
    const precip15min = minute?.precipitationMm ?? 0; // mm im 15-min Intervall
    const precipMmPerH = precip15min * 4;
    const precipProb = minute?.precipitationProbability ?? interp?.precipitationProbability ?? 0;
    const weatherCode = minute?.weatherCode ?? interp?.weatherCode;

    const synthetic: HourlyPoint = {
      ...(interp ?? { time: t.toISOString(), temperatureC: Number.NaN }),
      time: t.toISOString(),
      precipitationMm: precipMmPerH,
      weatherCode,
    };
    const score = severeScore(synthetic);
    const tp = thunderProbability(synthetic);
    const hail = hailRisk(synthetic);

    steps.push({
      time: t.toISOString(),
      minutesFromNow: Math.round((t.getTime() - now.getTime()) / 60_000),
      precipMmPerH,
      precipProb,
      thunderProb: tp,
      hail,
      severeScore: score.value,
      level: score.level,
      weatherCode,
      windSpeedMs: interp?.windSpeedMs,
      windGustMs: interp?.windGustMs,
      temperatureC: interp?.temperatureC,
      capeJkg: interp?.cape,
      liftedIndex: interp?.liftedIndex,
    });
  }

  const peak = steps.reduce<NowcastStep | null>((best, s) => !best || s.severeScore > best.severeScore ? s : best, null);
  const thunderProbMax = Math.max(0, ...steps.map((s) => s.thunderProb));
  const hailMax = steps.reduce<AlertSeverity | "none">((worst, s) => SEVERITY_ORDER.indexOf(s.hail) > SEVERITY_ORDER.indexOf(worst) ? s.hail : worst, "none");
  const precipMaxMmPerH = Math.max(0, ...steps.map((s) => s.precipMmPerH));
  const precipSumMm = steps.reduce((sum, s) => sum + s.precipMmPerH * (STEP_MINUTES / 60), 0);

  const hasMinutely = minutelySorted.length > 0;
  const hasConvective = hourlySorted.some((h) => h.cape != null || h.liftedIndex != null);
  const confidence = hasMinutely && hasConvective ? "hoch" : hasMinutely || hasConvective ? "mittel" : "niedrig";

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

function floorTo(date: Date, minutes: number) {
  const d = new Date(date);
  const m = d.getMinutes();
  d.setMinutes(m - (m % minutes), 0, 0);
  return d;
}

function findMinutely(points: MinutelyPoint[], t: Date): MinutelyPoint | null {
  if (points.length === 0) return null;
  const tMs = t.getTime();
  let candidate: MinutelyPoint | null = null;
  for (const p of points) {
    const ms = new Date(p.time).getTime();
    if (ms <= tMs && ms + 15 * 60_000 > tMs) return p;
    if (ms <= tMs) candidate = p;
    else break;
  }
  return candidate;
}

function interpolateHourly(points: HourlyPoint[], t: Date): HourlyPoint | null {
  if (points.length === 0) return null;
  const tMs = t.getTime();
  let a: HourlyPoint | null = null;
  let b: HourlyPoint | null = null;
  for (const p of points) {
    const ms = new Date(p.time).getTime();
    if (ms <= tMs) a = p;
    if (ms >= tMs && !b) { b = p; break; }
  }
  if (!a && b) return b;
  if (a && !b) return a;
  if (!a || !b || a === b) return a;
  const aMs = new Date(a.time).getTime();
  const bMs = new Date(b.time).getTime();
  const frac = (tMs - aMs) / Math.max(1, bMs - aMs);
  const lerp = (x?: number, y?: number) => x == null || y == null ? (x ?? y) : x + (y - x) * frac;
  return {
    ...a,
    time: t.toISOString(),
    temperatureC: lerp(a.temperatureC, b.temperatureC) ?? a.temperatureC,
    apparentTemperatureC: lerp(a.apparentTemperatureC, b.apparentTemperatureC),
    dewPointC: lerp(a.dewPointC, b.dewPointC),
    windSpeedMs: lerp(a.windSpeedMs, b.windSpeedMs),
    windGustMs: lerp(a.windGustMs, b.windGustMs),
    cape: lerp(a.cape, b.cape),
    liftedIndex: lerp(a.liftedIndex, b.liftedIndex),
    convectiveInhibition: lerp(a.convectiveInhibition, b.convectiveInhibition),
    freezingLevelM: lerp(a.freezingLevelM, b.freezingLevelM),
    relativeHumidity: lerp(a.relativeHumidity, b.relativeHumidity),
    pressureHpa: lerp(a.pressureHpa, b.pressureHpa),
    cloudCover: lerp(a.cloudCover, b.cloudCover),
    windSpeed80mMs: lerp(a.windSpeed80mMs, b.windSpeed80mMs),
    windSpeed180mMs: lerp(a.windSpeed180mMs, b.windSpeed180mMs),
  };
}

function headlineFor(level: AlertSeverity | "none", thunderProb: number, rainMmPerH: number, hail: AlertSeverity | "none"): string {
  if (level === "extreme") return "Extremes Unwetter im Anmarsch";
  if (hail !== "none" && SEVERITY_ORDER.indexOf(hail) >= 3) return "Hagelgefahr in den nächsten 2 Stunden";
  if (level === "severe") return "Schweres Unwetter in den nächsten 2 Stunden möglich";
  if (level === "moderate") return "Unwettersignal im 2-Stunden-Nowcast";
  if (thunderProb >= 0.5) return "Gewitter im 2-Stunden-Nowcast wahrscheinlich";
  if (rainMmPerH >= 5) return "Schauerstaffel im Anflug";
  if (level === "minor") return "Markante Entwicklung möglich";
  return "Ruhige Kurzfristlage in den nächsten 2 Stunden";
}

export function dailySeverity(hourly: HourlyPoint[], date: string) {
  const dayPoints = hourly.filter((p) => p.time.slice(0, 10) === date);
  if (dayPoints.length === 0) return { level: "none" as AlertSeverity | "none", score: 0, reasons: [] as string[] };
  let best = { level: "none" as AlertSeverity | "none", score: 0, reasons: [] as string[] };
  for (const p of dayPoints) {
    const s = severeScore(p);
    if (s.value > best.score) best = { level: s.level, score: s.value, reasons: s.reasons };
  }
  return best;
}