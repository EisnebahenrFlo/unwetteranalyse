import type { AlertSeverity } from "../types";

/**
 * DWD-orientierte Schwellen für eigene Einordnung.
 * Sinngemäße Anlehnung an öffentliche DWD-Warnkriterien.
 */
export interface ThresholdRule {
  id: string;
  parameter: string;
  label: string;
  explain: string;
  severity: AlertSeverity;
  evaluate: (value: number) => boolean;
  reason: (value: number) => string;
  unit: string;
}

const r = (rule: ThresholdRule): ThresholdRule => rule;

export const WIND_GUST_RULES: ThresholdRule[] = [
  r({
    id: "wind-minor",
    parameter: "windGust",
    label: "Windböen markant (≥ 14 m/s, Bft 7)",
    explain:
      "DWD-Warnschwelle für markante Windböen: ab ca. 50 km/h sind lose Gegenstände betroffen.",
    severity: "minor",
    evaluate: (v) => v >= 14 && v < 18,
    reason: (v) => `Spitzenböen um ${(v * 3.6).toFixed(0)} km/h (≥ 50 km/h, Bft 7).`,
    unit: "m/s",
  }),
  r({
    id: "wind-moderate",
    parameter: "windGust",
    label: "Sturmböen (≥ 18 m/s, Bft 8)",
    explain: "Sturmböen ab ca. 65 km/h, Äste können brechen.",
    severity: "moderate",
    evaluate: (v) => v >= 18 && v < 25,
    reason: (v) => `Spitzenböen um ${(v * 3.6).toFixed(0)} km/h (Sturm, Bft 8–9).`,
    unit: "m/s",
  }),
  r({
    id: "wind-severe",
    parameter: "windGust",
    label: "Schwerer Sturm (≥ 25 m/s, Bft 10)",
    explain: "Schwere Sturm- bis Orkanböen ab ca. 90 km/h, Bäume können entwurzelt werden.",
    severity: "severe",
    evaluate: (v) => v >= 25 && v < 33,
    reason: (v) => `Spitzenböen um ${(v * 3.6).toFixed(0)} km/h (schwerer Sturm).`,
    unit: "m/s",
  }),
  r({
    id: "wind-extreme",
    parameter: "windGust",
    label: "Orkanböen (≥ 33 m/s, Bft 12)",
    explain: "Orkan ab ca. 118 km/h, verbreitet Schäden möglich.",
    severity: "extreme",
    evaluate: (v) => v >= 33,
    reason: (v) => `Spitzenböen um ${(v * 3.6).toFixed(0)} km/h (Orkan).`,
    unit: "m/s",
  }),
];

export const PRECIP_RULES: ThresholdRule[] = [
  r({
    id: "rain-minor",
    parameter: "precip1h",
    label: "Starkregen markant (≥ 15 mm/h)",
    explain: "Markanter Starkregen, kleine Überflutungen möglich.",
    severity: "minor",
    evaluate: (v) => v >= 15 && v < 25,
    reason: (v) => `Niederschlag ${v.toFixed(1)} mm in einer Stunde.`,
    unit: "mm/h",
  }),
  r({
    id: "rain-moderate",
    parameter: "precip1h",
    label: "Heftiger Starkregen (≥ 25 mm/h)",
    explain: "Heftiger Starkregen, lokale Überflutungen wahrscheinlich.",
    severity: "moderate",
    evaluate: (v) => v >= 25 && v < 40,
    reason: (v) => `Niederschlag ${v.toFixed(1)} mm in einer Stunde.`,
    unit: "mm/h",
  }),
  r({
    id: "rain-severe",
    parameter: "precip1h",
    label: "Extremer Starkregen (≥ 40 mm/h)",
    explain: "Extremer Starkregen, ernsthafte Überflutungen möglich.",
    severity: "severe",
    evaluate: (v) => v >= 40,
    reason: (v) => `Niederschlag ${v.toFixed(1)} mm in einer Stunde.`,
    unit: "mm/h",
  }),
];

export const HEAT_RULES: ThresholdRule[] = [
  r({
    id: "heat-minor",
    parameter: "tempMax",
    label: "Wärmebelastung (≥ 28 °C)",
    explain: "Erhöhte Wärmebelastung möglich, vor allem bei hoher Luftfeuchte.",
    severity: "minor",
    evaluate: (v) => v >= 28 && v < 32,
    reason: (v) => `Höchsttemperatur ${v.toFixed(1)} °C.`,
    unit: "°C",
  }),
  r({
    id: "heat-moderate",
    parameter: "tempMax",
    label: "Starke Wärmebelastung (≥ 32 °C)",
    explain: "Starke Wärmebelastung, Vorsicht im Tagesverlauf.",
    severity: "moderate",
    evaluate: (v) => v >= 32 && v < 38,
    reason: (v) => `Höchsttemperatur ${v.toFixed(1)} °C.`,
    unit: "°C",
  }),
  r({
    id: "heat-severe",
    parameter: "tempMax",
    label: "Extreme Hitze (≥ 38 °C)",
    explain: "Extreme Wärmebelastung, gesundheitliche Risiken steigen deutlich.",
    severity: "severe",
    evaluate: (v) => v >= 38,
    reason: (v) => `Höchsttemperatur ${v.toFixed(1)} °C.`,
    unit: "°C",
  }),
];

export const FROST_RULES: ThresholdRule[] = [
  r({
    id: "frost-minor",
    parameter: "tempMin",
    label: "Leichter Frost (≤ −5 °C)",
    explain: "Verbreitet leichter Frost in der Nacht.",
    severity: "minor",
    evaluate: (v) => v <= -5 && v > -10,
    reason: (v) => `Tiefsttemperatur ${v.toFixed(1)} °C.`,
    unit: "°C",
  }),
  r({
    id: "frost-moderate",
    parameter: "tempMin",
    label: "Strenger Frost (≤ −10 °C)",
    explain: "Strenger Frost mit Risiken für Pflanzen und Leitungen.",
    severity: "moderate",
    evaluate: (v) => v <= -10 && v > -15,
    reason: (v) => `Tiefsttemperatur ${v.toFixed(1)} °C.`,
    unit: "°C",
  }),
  r({
    id: "frost-severe",
    parameter: "tempMin",
    label: "Sehr strenger Frost (≤ −15 °C)",
    explain: "Sehr strenger Frost, deutliche Gefahr für Mensch und Infrastruktur.",
    severity: "severe",
    evaluate: (v) => v <= -15,
    reason: (v) => `Tiefsttemperatur ${v.toFixed(1)} °C.`,
    unit: "°C",
  }),
];

export const CAPE_RULES: ThresholdRule[] = [
  r({
    id: "cape-minor",
    parameter: "cape",
    label: "Mäßige Labilität (≥ 500 J/kg)",
    explain: "Mäßige Labilität, einzelne Schauer/Gewitter möglich.",
    severity: "minor",
    evaluate: (v) => v >= 500 && v < 1500,
    reason: (v) => `CAPE um ${v.toFixed(0)} J/kg.`,
    unit: "J/kg",
  }),
  r({
    id: "cape-moderate",
    parameter: "cape",
    label: "Hohe Labilität (≥ 1500 J/kg)",
    explain: "Hohe Labilität, kräftige Gewitter möglich.",
    severity: "moderate",
    evaluate: (v) => v >= 1500 && v < 2500,
    reason: (v) => `CAPE um ${v.toFixed(0)} J/kg.`,
    unit: "J/kg",
  }),
  r({
    id: "cape-severe",
    parameter: "cape",
    label: "Extreme Labilität (≥ 2500 J/kg)",
    explain: "Extreme Labilität, Unwetter mit Hagel und Sturmböen möglich.",
    severity: "severe",
    evaluate: (v) => v >= 2500,
    reason: (v) => `CAPE um ${v.toFixed(0)} J/kg.`,
    unit: "J/kg",
  }),
];

export const ALL_RULES = [
  ...WIND_GUST_RULES,
  ...PRECIP_RULES,
  ...HEAT_RULES,
  ...FROST_RULES,
  ...CAPE_RULES,
];

export function severityWeight(s: AlertSeverity): number {
  return s === "extreme" ? 4 : s === "severe" ? 3 : s === "moderate" ? 2 : 1;
}
