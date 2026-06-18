import { liveHourly } from "../live";
import type { AlertSeverity, HourlyPoint } from "../types";
import { severeScore, thunderProbability } from "./convection";

export interface NowcastMetric {
  label: string;
  value: string;
  active: boolean;
}

export interface NowcastSummary {
  level: AlertSeverity | "none";
  score: number;
  headline: string;
  peakTime: string | null;
  triggers: string[];
  confidence: "niedrig" | "mittel" | "hoch";
  metrics: NowcastMetric[];
}

const NOWCAST_HOURS = 6;
const IMMEDIATE_HOURS = 3;

export function summarizeNowcast(hourly: HourlyPoint[], now: Date): NowcastSummary {
  const live = liveHourly(hourly, now).slice(0, NOWCAST_HOURS);
  const immediate = live.slice(0, IMMEDIATE_HOURS);
  const scored = immediate.map((point) => ({ point, score: severeScore(point) }));
  const peak = scored.reduce((best, item) => item.score.value > best.score.value ? item : best, scored[0]);

  const score = peak?.score.value ?? 0;
  const level = peak?.score.level ?? "none";
  const thunderMax = maxOf(live, (p) => thunderProbability(p) * 100);
  const rainMax = maxOf(live, (p) => p.precipitationMm ?? 0);
  const gustMaxKmh = maxOf(live, (p) => (p.windGustMs ?? 0) * 3.6);
  const capeMax = maxOf(live, (p) => p.cape ?? 0);
  const availableSignals = live.filter((p) => p.cape != null || p.liftedIndex != null || p.weatherCode != null).length;

  return {
    level,
    score,
    headline: headlineFor(level),
    peakTime: peak?.point.time ?? null,
    triggers: peak?.score.reasons.slice(0, 4) ?? [],
    confidence: availableSignals >= 4 ? "hoch" : availableSignals >= 2 ? "mittel" : "niedrig",
    metrics: [
      { label: "Gewitter", value: `${Math.round(thunderMax)} %`, active: thunderMax >= 30 },
      { label: "Starkregen", value: `${rainMax.toFixed(1)} mm/h`, active: rainMax >= 15 },
      { label: "Böen", value: `${Math.round(gustMaxKmh)} km/h`, active: gustMaxKmh >= 50 },
      { label: "CAPE", value: capeMax > 0 ? `${Math.round(capeMax)} J/kg` : "—", active: capeMax >= 500 },
    ],
  };
}

function maxOf(points: HourlyPoint[], fn: (point: HourlyPoint) => number) {
  return Math.max(0, ...points.map(fn).filter(Number.isFinite));
}

function headlineFor(level: AlertSeverity | "none") {
  if (level === "extreme") return "Extremes Unwettersignal im Nowcast";
  if (level === "severe") return "Deutliches Unwettersignal im Nowcast";
  if (level === "moderate") return "Unwettersignal im Nowcast";
  if (level === "minor") return "Markante Entwicklung möglich";
  return "Ruhige Kurzfristlage";
}