import type { AlertSeverity, DailyPoint, ForecastBundle, HourlyPoint } from "../types";
import { hailRisk, lowLevelShearMs, thunderProbability } from "./convection";

/**
 * Erweiterte Gefahrentypen jenseits der reinen Unwetter-Achse.
 * `category` trennt z. B. Hitze und Gewitter farblich und semantisch.
 */
export type HazardCategory =
  | "thunderstorm" | "hail" | "wind" | "rain" | "snow" | "ice"
  | "fog" | "heat" | "cold" | "uv" | "tornado";

export type HazardKind = AlertSeverity | "info" | "heat" | "cold";

export interface Hazard {
  id: string;
  category: HazardCategory;
  /** Schwere im klassischen Unwettersinn. */
  severity: AlertSeverity;
  /** Anzeige-Kategorie. `heat`/`cold` sind ausdrücklich KEIN „Unwetter". */
  kind: HazardKind;
  title: string;
  description: string;
  windowStart?: string;
  windowEnd?: string;
  peakValue?: string;
  /** 1–5, basiert auf Datenlage und Modellkonsens. */
  confidence: 1 | 2 | 3 | 4 | 5;
}

const RANK: AlertSeverity[] = ["minor", "moderate", "severe", "extreme"];
const worse = (a: AlertSeverity, b: AlertSeverity) => (RANK.indexOf(a) > RANK.indexOf(b) ? a : b);

function fmtHourRange(a: string, b: string) {
  const f = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${f(a)}–${f(b)} Uhr`;
}

function bucketRange(points: HourlyPoint[], pick: (p: HourlyPoint) => number | undefined, min: number) {
  let start: string | null = null;
  let end: string | null = null;
  let peak = 0;
  for (const p of points) {
    const v = pick(p);
    if (v != null && v >= min) {
      start ??= p.time;
      end = p.time;
      if (v > peak) peak = v;
    }
  }
  return start && end ? { start, end, peak } : null;
}

/** Confidence aus verfügbaren Feldern ableiten. */
function confidenceFor(p: HourlyPoint[]): 1 | 2 | 3 | 4 | 5 {
  const has = (k: keyof HourlyPoint) => p.some((x) => x[k] != null);
  let c = 2;
  if (has("cape")) c++;
  if (has("liftedIndex")) c++;
  if (has("windGustMs")) c++;
  return Math.min(5, c) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Tornado-Proxy ohne SRH: Shear × CAPE × niedriger LCL-Indikator
 * (Approx: hohe rH unten + niedrige Wolkenbasis = niedriger LCL).
 */
function tornadoProxyLevel(p: HourlyPoint): AlertSeverity | "none" {
  const cape = p.cape ?? 0;
  const shear = lowLevelShearMs(p) ?? 0;
  const rh = p.relativeHumidity ?? 0;
  if (cape < 500 || shear < 6) return "none";
  const score = (cape / 1000) * (shear / 10) * (rh > 75 ? 1.2 : 0.9);
  if (score >= 4) return "severe";
  if (score >= 2.5) return "moderate";
  if (score >= 1.5) return "minor";
  return "none";
}

/**
 * Gewitter-Klasse (Einzel-/Mehrzelle/Superzelle) aus CAPE × Shear.
 */
export function thunderstormMode(p: HourlyPoint): "single" | "multi" | "supercell" | "none" {
  const tp = thunderProbability(p);
  if (tp < 0.3) return "none";
  const cape = p.cape ?? 0;
  const shear = lowLevelShearMs(p) ?? 0;
  if (cape >= 1500 && shear >= 10) return "supercell";
  if (cape >= 800 && shear >= 6) return "multi";
  return "single";
}

export interface HazardSet {
  hazards: Hazard[];
  worstSevere: AlertSeverity | "none";
  peakWindow: { start: string; end: string } | null;
}

/**
 * Komplette Gefahrenliste für die nächsten 24 h, sauber nach Kategorie getrennt.
 */
export function buildHazards(bundle: ForecastBundle): HazardSet {
  const horizon = bundle.hourly.slice(0, 24);
  const days = bundle.daily.slice(0, 2);
  const list: Hazard[] = [];
  const conf = confidenceFor(horizon);

  // 1) Gewitter
  let tpMax = 0; let tpAt: HourlyPoint | null = null;
  let mode: "single" | "multi" | "supercell" | "none" = "none";
  for (const p of horizon) {
    const tp = thunderProbability(p);
    if (tp > tpMax) { tpMax = tp; tpAt = p; }
    const m = thunderstormMode(p);
    if (m === "supercell" || (m === "multi" && mode !== "supercell")) mode = m;
    else if (mode === "none" && m !== "none") mode = m;
  }
  if (tpMax >= 0.3 && tpAt) {
    const sev: AlertSeverity =
      mode === "supercell" ? "severe" : mode === "multi" ? "moderate" : tpMax >= 0.7 ? "moderate" : "minor";
    list.push({
      id: "thunder",
      category: "thunderstorm",
      severity: sev,
      kind: sev,
      title: mode === "supercell" ? "Superzellen-Potenzial" : mode === "multi" ? "Mehrzellige Gewitter" : "Einzelne Gewitter",
      description: `${Math.round(tpMax * 100)} % Gewitterwahrscheinlichkeit, Modus: ${mode === "supercell" ? "Superzelle" : mode === "multi" ? "Multizelle" : "Einzelzelle"}.`,
      windowStart: tpAt.time,
      windowEnd: tpAt.time,
      peakValue: `${Math.round(tpMax * 100)} %`,
      confidence: conf,
    });
  }

  // 2) Hagel
  let hailWorst: AlertSeverity | "none" = "none";
  let hailAt: HourlyPoint | null = null;
  for (const p of horizon) {
    const h = hailRisk(p);
    if (h !== "none" && (hailWorst === "none" || RANK.indexOf(h) > RANK.indexOf(hailWorst))) {
      hailWorst = h; hailAt = p;
    }
  }
  if (hailWorst !== "none" && hailAt) {
    list.push({
      id: "hail",
      category: "hail",
      severity: hailWorst,
      kind: hailWorst,
      title: `Hagelrisiko ${hailWorst === "severe" ? "hoch" : hailWorst === "moderate" ? "erhöht" : "gering"}`,
      description: `CAPE ${hailAt.cape?.toFixed(0)} J/kg, LI ${hailAt.liftedIndex?.toFixed(1)}, 0 °C bei ${hailAt.freezingLevelM?.toFixed(0)} m.`,
      windowStart: hailAt.time,
      windowEnd: hailAt.time,
      confidence: conf,
    });
  }

  // 3) Tornado-Hinweis
  let tornadoWorst: AlertSeverity | "none" = "none";
  let tornadoAt: HourlyPoint | null = null;
  for (const p of horizon) {
    const t = tornadoProxyLevel(p);
    if (t !== "none" && (tornadoWorst === "none" || RANK.indexOf(t) > RANK.indexOf(tornadoWorst))) {
      tornadoWorst = t; tornadoAt = p;
    }
  }
  if (tornadoWorst !== "none" && tornadoAt) {
    list.push({
      id: "tornado",
      category: "tornado",
      severity: tornadoWorst,
      kind: tornadoWorst,
      title: `Tornado-Indikatoren ${tornadoWorst === "severe" ? "deutlich" : tornadoWorst === "moderate" ? "erhöht" : "leicht erhöht"}`,
      description: "Heuristik aus CAPE, Low-Level-Shear und Feuchte. Kein Ersatz für offizielle Warnung.",
      windowStart: tornadoAt.time,
      confidence: Math.max(1, conf - 1) as 1 | 2 | 3 | 4 | 5,
    });
  }

  // 4) Wind / Sturm
  const gustMax = horizon.reduce<{ v: number; t: string } | null>((b, p) => {
    const v = p.windGustMs ?? 0;
    return !b || v > b.v ? { v, t: p.time } : b;
  }, null);
  if (gustMax && gustMax.v >= 14) {
    const sev: AlertSeverity = gustMax.v >= 33 ? "extreme" : gustMax.v >= 25 ? "severe" : gustMax.v >= 18 ? "moderate" : "minor";
    list.push({
      id: "wind",
      category: "wind",
      severity: sev,
      kind: sev,
      title: sev === "extreme" ? "Orkanböen" : sev === "severe" ? "Schwerer Sturm" : sev === "moderate" ? "Sturmböen" : "Windige Phase",
      description: `Spitzenböen bis ${(gustMax.v * 3.6).toFixed(0)} km/h.`,
      windowStart: gustMax.t,
      peakValue: `${(gustMax.v * 3.6).toFixed(0)} km/h`,
      confidence: conf,
    });
  }

  // 5) Starkregen kurz (1h) vs Dauerregen (6h Summe)
  const rainPeak = horizon.reduce<{ v: number; t: string } | null>((b, p) => {
    const v = p.precipitationMm ?? 0;
    return !b || v > b.v ? { v, t: p.time } : b;
  }, null);
  if (rainPeak && rainPeak.v >= 5) {
    const sev: AlertSeverity = rainPeak.v >= 40 ? "severe" : rainPeak.v >= 25 ? "moderate" : rainPeak.v >= 15 ? "minor" : "minor";
    list.push({
      id: "rain",
      category: "rain",
      severity: sev,
      kind: sev,
      title: rainPeak.v >= 40 ? "Extremer Starkregen" : rainPeak.v >= 25 ? "Heftiger Starkregen" : rainPeak.v >= 15 ? "Starkregen markant" : "Schauerintensität",
      description: `Bis ${rainPeak.v.toFixed(1)} mm in einer Stunde möglich.`,
      windowStart: rainPeak.t,
      peakValue: `${rainPeak.v.toFixed(1)} mm/h`,
      confidence: conf,
    });
  }
  const rain6 = (() => {
    let max = 0; let at = "";
    for (let i = 0; i + 6 <= horizon.length; i++) {
      const sum = horizon.slice(i, i + 6).reduce((s, p) => s + (p.precipitationMm ?? 0), 0);
      if (sum > max) { max = sum; at = horizon[i].time; }
    }
    return { max, at };
  })();
  if (rain6.max >= 30) {
    const sev: AlertSeverity = rain6.max >= 70 ? "severe" : rain6.max >= 50 ? "moderate" : "minor";
    list.push({
      id: "rain-6h",
      category: "rain",
      severity: sev,
      kind: sev,
      title: "Dauerregen",
      description: `Summe ${rain6.max.toFixed(0)} mm in 6 Stunden möglich.`,
      windowStart: rain6.at,
      peakValue: `${rain6.max.toFixed(0)} mm/6h`,
      confidence: conf,
    });
  }

  // 6) Glätte / gefrierender Regen / Schnee
  const ice = bucketRange(horizon, (p) => ((p.precipitationMm ?? 0) > 0.1 && p.temperatureC <= 1 ? 1 : 0), 1);
  if (ice) {
    list.push({
      id: "ice",
      category: "ice",
      severity: "moderate",
      kind: "cold",
      title: "Glättegefahr",
      description: "Niederschlag bei Temperaturen um den Gefrierpunkt.",
      windowStart: ice.start, windowEnd: ice.end,
      confidence: conf,
    });
  }
  const snowSum = horizon.reduce((s, p) => s + (p.snowfallCm ?? 0), 0);
  if (snowSum >= 2) {
    const sev: AlertSeverity = snowSum >= 20 ? "severe" : snowSum >= 10 ? "moderate" : "minor";
    list.push({
      id: "snow",
      category: "snow",
      severity: sev,
      kind: "cold",
      title: `Schneefall ${sev === "severe" ? "stark" : sev === "moderate" ? "ergiebig" : "leicht"}`,
      description: `Bis ${snowSum.toFixed(0)} cm Neuschnee in 24 h.`,
      peakValue: `${snowSum.toFixed(0)} cm`,
      confidence: conf,
    });
  }

  // 7) Nebel
  const fog = horizon.find((p) => (p.visibilityM ?? 9999) <= 200);
  if (fog) {
    list.push({
      id: "fog",
      category: "fog",
      severity: "minor",
      kind: "info",
      title: "Dichter Nebel",
      description: `Sicht unter 200 m ab ${new Date(fog.time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr.`,
      windowStart: fog.time,
      confidence: conf,
    });
  }

  // 8) Hitze (eigene Kategorie, NICHT Unwetter)
  for (const d of days) {
    if (d.tempMaxC >= 28) {
      const sev: AlertSeverity = d.tempMaxC >= 38 ? "severe" : d.tempMaxC >= 32 ? "moderate" : "minor";
      list.push({
        id: `heat-${d.date}`,
        category: "heat",
        severity: sev,
        kind: "heat",
        title: d.tempMaxC >= 38 ? "Extreme Hitze" : d.tempMaxC >= 32 ? "Starke Wärmebelastung" : "Wärmebelastung",
        description: `Höchstwert ${d.tempMaxC.toFixed(0)} °C am ${new Date(d.date).toLocaleDateString("de-DE", { weekday: "short" })}.`,
        peakValue: `${d.tempMaxC.toFixed(0)} °C`,
        confidence: 4,
      });
      break;
    }
  }
  // Tropennacht
  const tropical = days.find((d) => d.tempMinC >= 20);
  if (tropical) {
    list.push({
      id: `tropical-${tropical.date}`,
      category: "heat",
      severity: "minor",
      kind: "heat",
      title: "Tropennacht",
      description: `Tiefstwert nicht unter ${tropical.tempMinC.toFixed(0)} °C.`,
      confidence: 4,
    });
  }

  // 9) UV (Hinweis)
  const uvMax = Math.max(0, ...horizon.map((p) => p.uvIndex ?? 0));
  if (uvMax >= 6) {
    list.push({
      id: "uv",
      category: "uv",
      severity: "minor",
      kind: "info",
      title: `UV-Index hoch (${uvMax.toFixed(0)})`,
      description: uvMax >= 8 ? "Sehr hohe UV-Belastung, Schutz dringend nötig." : "Hohe UV-Belastung, Schutz empfohlen.",
      confidence: 4,
    });
  }

  // Worst Severe (nur „echte" Unwetter)
  const severeOnly = list.filter((h) => h.kind !== "heat" && h.kind !== "cold" && h.kind !== "info");
  let worst: AlertSeverity | "none" = "none";
  for (const h of severeOnly) worst = worst === "none" ? h.severity : worse(worst, h.severity);

  // Peak-Fenster aus zusammenhängenden Stunden mit Severe-Signal
  const peakWindow = computePeakWindow(horizon);

  // Sortierung: zuerst echte Unwetter nach Schwere, dann Heat/Cold/Info
  list.sort((a, b) => {
    const aSev = a.kind === "heat" || a.kind === "cold" || a.kind === "info" ? -1 : RANK.indexOf(a.severity);
    const bSev = b.kind === "heat" || b.kind === "cold" || b.kind === "info" ? -1 : RANK.indexOf(b.severity);
    return bSev - aSev;
  });

  return { hazards: list, worstSevere: worst, peakWindow };
}

/**
 * Findet das stärkste zusammenhängende Severe-Fenster (Score ≥ 20).
 */
function computePeakWindow(horizon: HourlyPoint[]): { start: string; end: string } | null {
  const ranked = horizon.map((p) => {
    let v = 0;
    const tp = thunderProbability(p);
    if (tp >= 0.3) v += tp * 35;
    if ((p.precipitationMm ?? 0) >= 15) v += 12;
    if ((p.windGustMs ?? 0) >= 14) v += 10;
    if (hailRisk(p) !== "none") v += 12;
    return { t: p.time, v };
  });
  let bestStart = -1, bestEnd = -1, bestSum = 0;
  let curStart = -1, curSum = 0;
  for (let i = 0; i < ranked.length; i++) {
    if (ranked[i].v >= 20) {
      if (curStart === -1) curStart = i;
      curSum += ranked[i].v;
      if (curSum > bestSum) { bestSum = curSum; bestStart = curStart; bestEnd = i; }
    } else {
      curStart = -1; curSum = 0;
    }
  }
  if (bestStart === -1) return null;
  return { start: ranked[bestStart].t, end: ranked[bestEnd].t };
}

export function formatHazardWindow(h: Hazard): string {
  if (h.windowStart && h.windowEnd && h.windowStart !== h.windowEnd) return fmtHourRange(h.windowStart, h.windowEnd);
  if (h.windowStart) return `ab ${new Date(h.windowStart).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
  return "im Tagesverlauf";
}

export function dailyHazardPeak(daily: DailyPoint, hourly: HourlyPoint[]) {
  const dayPoints = hourly.filter((p) => p.time.slice(0, 10) === daily.date);
  let cape = 0, gust = 0, rain = 0, tp = 0;
  for (const p of dayPoints) {
    cape = Math.max(cape, p.cape ?? 0);
    gust = Math.max(gust, p.windGustMs ?? 0);
    rain = Math.max(rain, p.precipitationMm ?? 0);
    tp = Math.max(tp, thunderProbability(p));
  }
  return { cape, gust, rain, tp };
}