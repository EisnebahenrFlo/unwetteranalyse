/**
 * 24-Stunden-Bewertung mit Stunden-Auflösung.
 */

import type { HourlyPoint } from "../types";
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
import { combineToday } from "./combine";
import { hazardBoostFloor } from "./hazard-axes";

export interface HourScore {
  time: string;
  point: HourlyPoint;
  rain: Subscore;
  wind: Subscore;
  thunder: Subscore;
  convection: Subscore;
  total: number;
  band: Band;
}

export interface TodayResult {
  hours: HourScore[];
  total: number;
  band: Band;
  peakWindow: { startAt: string; endAt: string } | null;
  peakAt: string | null;
  subs: { rain: Subscore; wind: Subscore; thunder: Subscore; convection: Subscore };
  data: Subscore;
  reasons: string[];
  confidence: "niedrig" | "mittel" | "hoch";
}

function maxSub(arr: Subscore[]): Subscore {
  return arr.reduce((b, s) => (s.value > b.value ? s : b), arr[0]);
}

export interface TodayInput {
  hourly: HourlyPoint[];
  liveObsAgeMinutes?: number | null;
  radarAgeMinutes?: number | null;
  modelObsConsistent?: boolean | null;
}

export function buildToday(input: TodayInput): TodayResult {
  const horizon = input.hourly.slice(0, 24);
  const hours: HourScore[] = horizon.map((p) => {
    const r = rainSubscore(p);
    const w = windSubscore(p);
    const t = thunderSubscore(p);
    const c = convectionSubscore(p);
    const total = Math.max(combineToday(r.value, w.value, t.value, c.value), hazardBoostFloor(p));
    return {
      time: p.time,
      point: p,
      rain: r,
      wind: w,
      thunder: t,
      convection: c,
      total,
      band: bandFromScore(total),
    };
  });

  const peak = hours.reduce((b, h) => (h.total > b.total ? h : b), hours[0]);
  let peakWindow: TodayResult["peakWindow"] = null;
  if (peak && peak.total >= 20) {
    const thresh = Math.max(20, peak.total * 0.75);
    const idx = hours.indexOf(peak);
    let s = idx,
      e = idx;
    while (s > 0 && hours[s - 1].total >= thresh) s--;
    while (e < hours.length - 1 && hours[e + 1].total >= thresh) e++;
    peakWindow = { startAt: hours[s].time, endAt: hours[e].time };
  }

  const rainAgg = maxSub(hours.map((h) => h.rain));
  const windAgg = maxSub(hours.map((h) => h.wind));
  const thunderAgg = maxSub(hours.map((h) => h.thunder));
  const convAgg = maxSub(hours.map((h) => h.convection));
  const maxHazardFloor = Math.max(0, ...hours.map((h) => hazardBoostFloor(h.point)));
  const total = Math.max(
    combineToday(rainAgg.value, windAgg.value, thunderAgg.value, convAgg.value),
    maxHazardFloor,
  );

  const ctx: DataContextInput = {
    hasMinutely: false,
    hasUpperLevels: horizon.some((h) => h.temperature850hPa != null),
    hasConvective: horizon.some((h) => h.cape != null || h.liftedIndex != null),
    liveObsAgeMinutes: input.liveObsAgeMinutes ?? null,
    radarAgeMinutes: input.radarAgeMinutes ?? null,
    modelObsConsistent: input.modelObsConsistent ?? null,
  };
  const data = dataConfidence(ctx);

  const reasons: string[] = [];
  if (thunderAgg.value >= 35) reasons.push(`Gewitterpotenzial ${thunderAgg.band}`);
  if (convAgg.value >= 35) reasons.push(`Labilität ${convAgg.band}`);
  if (rainAgg.value >= 35) reasons.push(`Niederschlag ${rainAgg.band}`);
  if (windAgg.value >= 35) reasons.push(`Wind ${windAgg.band}`);
  if (reasons.length === 0) reasons.push("kein dominantes Tagessignal");

  return {
    hours,
    total,
    band: bandFromScore(total),
    peakWindow,
    peakAt: peak?.time ?? null,
    subs: { rain: rainAgg, wind: windAgg, thunder: thunderAgg, convection: convAgg },
    data,
    reasons,
    confidence: confidenceLabel(data.value),
  };
}