import type { ForecastBundle, HourlyPoint, WeatherAlert, AlertSeverity } from "../types";
import {
  CAPE_RULES,
  FROST_RULES,
  HEAT_RULES,
  PRECIP_RULES,
  WIND_GUST_RULES,
  severityWeight,
  type ThresholdRule,
} from "../thresholds/dwd";

export interface DerivedAlert {
  rule: ThresholdRule;
  value: number;
  at: string;
}

function evalSeries(
  points: HourlyPoint[],
  pick: (p: HourlyPoint) => number | undefined,
  rules: ThresholdRule[],
): DerivedAlert[] {
  const out = new Map<string, DerivedAlert>();
  for (const p of points) {
    const v = pick(p);
    if (v == null || Number.isNaN(v)) continue;
    for (const rule of rules) {
      if (!rule.evaluate(v)) continue;
      const prev = out.get(rule.id);
      if (
        !prev ||
        severityWeight(rule.severity) > severityWeight(prev.rule.severity) ||
        v > prev.value
      ) {
        out.set(rule.id, { rule, value: v, at: p.time });
      }
    }
  }
  return [...out.values()];
}

export function deriveAlertsFromForecast(bundle: ForecastBundle): DerivedAlert[] {
  const horizon = bundle.hourly.slice(0, 48);
  const wind = evalSeries(horizon, (p) => p.windGustMs, WIND_GUST_RULES);
  const precip = evalSeries(horizon, (p) => p.precipitationMm, PRECIP_RULES);
  const cape = evalSeries(horizon, (p) => p.cape, CAPE_RULES);
  const heat: DerivedAlert[] = [];
  const frost: DerivedAlert[] = [];
  for (const d of bundle.daily.slice(0, 3)) {
    for (const rule of HEAT_RULES) {
      if (rule.evaluate(d.tempMaxC)) heat.push({ rule, value: d.tempMaxC, at: d.date });
    }
    for (const rule of FROST_RULES) {
      if (rule.evaluate(d.tempMinC)) frost.push({ rule, value: d.tempMinC, at: d.date });
    }
  }
  return [...wind, ...precip, ...cape, ...heat, ...frost].sort(
    (a, b) => severityWeight(b.rule.severity) - severityWeight(a.rule.severity),
  );
}

export function findNextChange(hourly: HourlyPoint[]): { at: string; summary: string } | null {
  if (hourly.length < 3) return null;
  const now = hourly[0];
  for (let i = 1; i < Math.min(hourly.length, 24); i++) {
    const p = hourly[i];
    if ((p.precipitationMm ?? 0) >= 0.5 && (now.precipitationMm ?? 0) < 0.2) {
      return {
        at: p.time,
        summary: `Niederschlag setzt ein (${p.precipitationMm?.toFixed(1)} mm/h).`,
      };
    }
    if ((p.windGustMs ?? 0) >= 14 && (now.windGustMs ?? 0) < 10) {
      return {
        at: p.time,
        summary: `Böen frischen auf (${((p.windGustMs ?? 0) * 3.6).toFixed(0)} km/h).`,
      };
    }
    if (Math.abs(p.temperatureC - now.temperatureC) >= 5) {
      const dir = p.temperatureC > now.temperatureC ? "steigt" : "fällt";
      return {
        at: p.time,
        summary: `Temperatur ${dir} deutlich auf ${p.temperatureC.toFixed(1)} °C.`,
      };
    }
  }
  return null;
}

export interface ConvectionSummary {
  capeMax: number | null;
  liMin: number | null;
  level: AlertSeverity | "none";
  text: string;
}

export function summarizeConvection(hourly: HourlyPoint[]): ConvectionSummary {
  const horizon = hourly.slice(0, 24);
  const capes = horizon.map((h) => h.cape).filter((v): v is number => v != null);
  const lis = horizon.map((h) => h.liftedIndex).filter((v): v is number => v != null);
  const capeMax = capes.length ? Math.max(...capes) : null;
  const liMin = lis.length ? Math.min(...lis) : null;
  let level: ConvectionSummary["level"] = "none";
  if (capeMax != null) {
    if (capeMax >= 2500) level = "severe";
    else if (capeMax >= 1500) level = "moderate";
    else if (capeMax >= 500) level = "minor";
  }
  const text =
    level === "none"
      ? "Stabil, keine relevante Gewitterneigung erkennbar."
      : level === "minor"
        ? "Mäßige Labilität, einzelne Schauer oder Gewitter möglich."
        : level === "moderate"
          ? "Erhöhte Labilität, kräftige Gewitter möglich."
          : "Hohe Labilität, organisierte Gewitter mit Unwetterpotenzial möglich.";
  return { capeMax, liMin, level, text };
}

export interface WinterSummary {
  snowfallSumCm: number;
  freezingLevelMinM: number | null;
  text: string;
}

export function summarizeWinter(hourly: HourlyPoint[]): WinterSummary {
  const horizon = hourly.slice(0, 24);
  const snowfallSumCm = horizon.reduce((acc, p) => acc + (p.snowfallCm ?? 0), 0);
  const fl = horizon.map((h) => h.freezingLevelM).filter((v): v is number => v != null);
  const freezingLevelMinM = fl.length ? Math.min(...fl) : null;
  const text =
    snowfallSumCm >= 5
      ? `Innerhalb 24 h rund ${snowfallSumCm.toFixed(0)} cm Neuschnee möglich.`
      : snowfallSumCm > 0
        ? `Geringer Neuschnee (${snowfallSumCm.toFixed(1)} cm) möglich.`
        : "Keine nennenswerten Schneefallmengen.";
  return { snowfallSumCm, freezingLevelMinM, text };
}

export function derivedToAlert(d: DerivedAlert): WeatherAlert {
  return {
    id: `derived-${d.rule.id}-${d.at}`,
    headline: d.rule.label,
    description: d.rule.reason(d.value),
    instruction: d.rule.explain,
    severity: d.rule.severity,
    event: d.rule.parameter,
    onset: d.at,
    expires: new Date(new Date(d.at).getTime() + 3 * 3600_000).toISOString(),
    source: "dwd",
  };
}
