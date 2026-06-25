/**
 * 2-Stunden Nowcast in 10-Minuten-Schritten mit transparentem Scoring.
 */

import type { HourlyPoint, MinutelyPoint } from "../types";
import { bandFromScore, type Band, confidenceLabel } from "./labels";
import {
  convectionSubscore,
  dataConfidence,
  type DataContextInput,
  rainSubscore,
  thunderSubscore,
  windSubscore,
  type Subscore,
} from "./subscores";

const STEP_MINUTES = 10;
const STEPS = 12;

export interface NowcastStep {
  time: string;
  minutesFromNow: number;
  weatherCode?: number;
  point: HourlyPoint;
  rain: Subscore;
  wind: Subscore;
  thunder: Subscore;
  convection: Subscore;
  total: number;
  band: Band;
}

export interface NowcastResult {
  steps: NowcastStep[];
  total: number;
  band: Band;
  peakAt: string | null;
  peakMinutes: number;
  subs: { rain: Subscore; wind: Subscore; thunder: Subscore; convection: Subscore };
  data: Subscore;
  reasons: string[];
  confidence: "niedrig" | "mittel" | "hoch";
}

const W = { rain: 0.35, wind: 0.2, thunder: 0.3, convection: 0.15 };

function combine(rain: number, wind: number, thunder: number, convection: number): number {
  const linear = rain * W.rain + wind * W.wind + thunder * W.thunder + convection * W.convection;
  const maxSub = Math.max(rain, wind, thunder, convection);
  return Math.round(Math.max(linear, maxSub * 0.85));
}

function floorTo(date: Date, minutes: number) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - (d.getMinutes() % minutes), 0, 0);
  return d;
}

function findMinutely(points: MinutelyPoint[], t: Date): MinutelyPoint | null {
  if (!points.length) return null;
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

function interpolate(points: HourlyPoint[], t: Date): HourlyPoint | null {
  if (!points.length) return null;
  const tMs = t.getTime();
  let a: HourlyPoint | null = null,
    b: HourlyPoint | null = null;
  for (const p of points) {
    const ms = new Date(p.time).getTime();
    if (ms <= tMs) a = p;
    if (ms >= tMs && !b) {
      b = p;
      break;
    }
  }
  if (!a && b) return b;
  if (a && !b) return a;
  if (!a || !b || a === b) return a;
  const aMs = new Date(a.time).getTime();
  const bMs = new Date(b.time).getTime();
  const f = (tMs - aMs) / Math.max(1, bMs - aMs);
  const L = (x?: number, y?: number) => (x == null || y == null ? (x ?? y) : x + (y - x) * f);
  return {
    ...a,
    time: t.toISOString(),
    temperatureC: L(a.temperatureC, b.temperatureC) ?? a.temperatureC,
    apparentTemperatureC: L(a.apparentTemperatureC, b.apparentTemperatureC),
    dewPointC: L(a.dewPointC, b.dewPointC),
    windSpeedMs: L(a.windSpeedMs, b.windSpeedMs),
    windGustMs: L(a.windGustMs, b.windGustMs),
    cape: L(a.cape, b.cape),
    liftedIndex: L(a.liftedIndex, b.liftedIndex),
    convectiveInhibition: L(a.convectiveInhibition, b.convectiveInhibition),
    freezingLevelM: L(a.freezingLevelM, b.freezingLevelM),
    relativeHumidity: L(a.relativeHumidity, b.relativeHumidity),
    pressureHpa: L(a.pressureHpa, b.pressureHpa),
    cloudCover: L(a.cloudCover, b.cloudCover),
    windSpeed80mMs: L(a.windSpeed80mMs, b.windSpeed80mMs),
    windSpeed180mMs: L(a.windSpeed180mMs, b.windSpeed180mMs),
    temperature850hPa: L(a.temperature850hPa, b.temperature850hPa),
    temperature700hPa: L(a.temperature700hPa, b.temperature700hPa),
    temperature500hPa: L(a.temperature500hPa, b.temperature500hPa),
    dewPoint850hPa: L(a.dewPoint850hPa, b.dewPoint850hPa),
    dewPoint700hPa: L(a.dewPoint700hPa, b.dewPoint700hPa),
  };
}

function aggregateSub(steps: Subscore[], take = 6): Subscore {
  let best = steps[0];
  for (const s of steps) if (s.value > best.value) best = s;
  const slice = steps.slice(0, take);
  const conf = Math.round(slice.reduce((s, x) => s + x.confidence, 0) / Math.max(1, slice.length));
  return { ...best, confidence: conf };
}

export interface NowcastInput {
  hourly: HourlyPoint[];
  minutely?: MinutelyPoint[];
  now: Date;
  liveObsAgeMinutes?: number | null;
  radarAgeMinutes?: number | null;
  /** Max-dBZ aus dem aktuellen Radar-Snapshot (für Gewitter-Verstärkung im ersten Step). */
  radarTopDbz?: number | null;
  modelObsConsistent?: boolean | null;
}

export function buildNowcast(input: NowcastInput): NowcastResult {
  const t0 = floorTo(input.now, STEP_MINUTES);
  const minutely = (input.minutely ?? []).slice().sort((a, b) => a.time.localeCompare(b.time));
  const hourly = input.hourly.slice().sort((a, b) => a.time.localeCompare(b.time));

  const steps: NowcastStep[] = [];
  for (let i = 0; i < STEPS; i++) {
    const t = new Date(t0.getTime() + i * STEP_MINUTES * 60_000);
    const interp = interpolate(hourly, t);
    const minute = findMinutely(minutely, t);
    const precipPerH = (minute?.precipitationMm ?? 0) * 4;
    const code = minute?.weatherCode ?? interp?.weatherCode;
    const point: HourlyPoint = {
      ...(interp ?? { time: t.toISOString(), temperatureC: Number.NaN }),
      time: t.toISOString(),
      precipitationMm: precipPerH,
      precipitationProbability:
        minute?.precipitationProbability ?? interp?.precipitationProbability,
      weatherCode: code,
    };
    const rain = rainSubscore(point);
    const wind = windSubscore(point);
    const thunder = thunderSubscore(point, {
      radarTopDbz: i === 0 ? (input.radarTopDbz ?? null) : null,
    });
    const conv = convectionSubscore(point);
    const total = combine(rain.value, wind.value, thunder.value, conv.value);
    steps.push({
      time: t.toISOString(),
      minutesFromNow: Math.round((t.getTime() - input.now.getTime()) / 60_000),
      weatherCode: code,
      point,
      rain,
      wind,
      thunder,
      convection: conv,
      total,
      band: bandFromScore(total),
    });
  }

  const peak = steps.reduce((b, s) => (s.total > b.total ? s : b), steps[0]);
  const rainAgg = aggregateSub(steps.map((s) => s.rain));
  const windAgg = aggregateSub(steps.map((s) => s.wind));
  const thunderAgg = aggregateSub(steps.map((s) => s.thunder));
  const convAgg = aggregateSub(steps.map((s) => s.convection));
  const total = combine(rainAgg.value, windAgg.value, thunderAgg.value, convAgg.value);

  const ctx: DataContextInput = {
    hasMinutely: minutely.length > 0,
    hasUpperLevels: hourly.some((h) => h.temperature850hPa != null),
    hasConvective: hourly.some((h) => h.cape != null || h.liftedIndex != null),
    liveObsAgeMinutes: input.liveObsAgeMinutes ?? null,
    radarAgeMinutes: input.radarAgeMinutes ?? null,
    modelObsConsistent: input.modelObsConsistent ?? null,
  };
  const data = dataConfidence(ctx);

  const reasons: string[] = [];
  if (thunderAgg.value >= 35) reasons.push(`Gewittersignal ${thunderAgg.band}`);
  if (rainAgg.value >= 35) reasons.push(`Regen ${rainAgg.band}`);
  if (windAgg.value >= 35) reasons.push(`Wind ${windAgg.band}`);
  if (convAgg.value >= 35) reasons.push(`Labilität ${convAgg.band}`);
  if (reasons.length === 0) reasons.push("keine Signale über Schwelle");

  return {
    steps,
    total,
    band: bandFromScore(total),
    peakAt: peak?.time ?? null,
    peakMinutes: peak?.minutesFromNow ?? 0,
    subs: { rain: rainAgg, wind: windAgg, thunder: thunderAgg, convection: convAgg },
    data,
    reasons,
    confidence: confidenceLabel(data.value),
  };
}