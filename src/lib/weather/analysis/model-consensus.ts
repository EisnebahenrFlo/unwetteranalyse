import type { ModelSeries, HourlyPoint } from "../types";
import { severeScore, thunderProbability, summarizeModelSevere } from "./convection";
import { liveHourly } from "../live";

export type ConsensusMetric =
  | "temperatureC" | "dewPointC" | "precipitationMm" | "precipitationProbability"
  | "windGustMs" | "cape" | "liftedIndex";

export interface CorridorPoint {
  time: string;
  median: number | null;
  min: number | null;
  max: number | null;
  /** [min, range] für recharts Stacked-Area. */
  band: [number, number] | null;
}

/** Pro Zeitpunkt Median + Spannweite über alle Modelle für ein Feld. */
export function buildCorridor(series: ModelSeries[], metric: ConsensusMetric, now: Date, hours = 72): CorridorPoint[] {
  const allTimes = new Set<string>();
  for (const s of series) for (const h of liveHourly(s.hourly, now)) allTimes.add(h.time);
  const sorted = Array.from(allTimes).sort().slice(0, hours);
  return sorted.map((t) => {
    const vals: number[] = [];
    for (const s of series) {
      const p = s.hourly.find((h) => h.time === t);
      const v = p?.[metric];
      if (v != null && Number.isFinite(v as number)) vals.push(Number(v));
    }
    if (vals.length === 0) return { time: t, median: null, min: null, max: null, band: null };
    vals.sort((a, b) => a - b);
    const mid = Math.floor(vals.length / 2);
    const median = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    const min = vals[0];
    const max = vals[vals.length - 1];
    return { time: t, median, min, max, band: [min, max - min] };
  });
}

export interface ConsensusSummary {
  modelCount: number;
  signalingCount: number;
  /** Modelle mit severe-Level >= minor in 24 h. */
  signalingRatio: number;
  /** Bestes Hauptsignal-Fenster: [startISO, endISO] für median(thunderProb) > 0.3. */
  signalWindow: { start: string; end: string } | null;
  /** 0–100, höchster worstScore über alle Modelle in 24 h. */
  riskMax: number;
  /** Spread des worstScore über Modelle. */
  scoreSpread: number;
  /** "low" | "mid" | "high" qualitative Unsicherheit. */
  uncertainty: "low" | "mid" | "high";
  /** Kurzes Lagefazit, deterministisch generiert. */
  headline: string;
}

export function buildConsensus(series: ModelSeries[], now: Date): ConsensusSummary {
  const live = series.map((s) => ({ s, h: liveHourly(s.hourly, now).slice(0, 24) }));
  const summaries = live.map(({ h }) => summarizeModelSevere(h));
  const scores = summaries.map((x) => x.worstScore);
  const signaling = summaries.filter((x) => x.level !== "none").length;
  const riskMax = scores.length ? Math.max(...scores) : 0;
  const riskMin = scores.length ? Math.min(...scores) : 0;
  const spread = riskMax - riskMin;

  // Median thunderProb pro Stunde → Hauptsignal-Fenster
  const times = new Set<string>();
  for (const { h } of live) for (const p of h) times.add(p.time);
  const sortedTimes = Array.from(times).sort();
  const medianTp: { t: string; v: number }[] = sortedTimes.map((t) => {
    const vs: number[] = [];
    for (const { h } of live) {
      const p = h.find((x) => x.time === t);
      if (p) vs.push(thunderProbability(p));
    }
    vs.sort((a, b) => a - b);
    const m = vs.length ? (vs.length % 2 ? vs[(vs.length - 1) >> 1] : (vs[vs.length / 2 - 1] + vs[vs.length / 2]) / 2) : 0;
    return { t, v: m };
  });
  let window: ConsensusSummary["signalWindow"] = null;
  let bestLen = 0;
  let i = 0;
  while (i < medianTp.length) {
    if (medianTp[i].v > 0.3) {
      let j = i;
      while (j + 1 < medianTp.length && medianTp[j + 1].v > 0.3) j++;
      const len = j - i + 1;
      if (len > bestLen) { bestLen = len; window = { start: medianTp[i].t, end: medianTp[j].t }; }
      i = j + 1;
    } else i++;
  }

  // Unsicherheit aus Score-Spread + Anteil unsicherer Modelle
  const uncertainty: ConsensusSummary["uncertainty"] =
    spread >= 35 ? "high" : spread >= 18 ? "mid" : "low";

  // Kurzfazit
  const ratio = series.length ? signaling / series.length : 0;
  let headline = "Modelle zeigen ruhige Wetterlage ohne markante Signale.";
  if (riskMax >= 70) headline = `Mehrheit der Modelle signalisiert Unwetterpotenzial${window ? ` im Fenster ${fmtH(window.start)}–${fmtH(window.end)} Uhr` : ""}.`;
  else if (riskMax >= 45) headline = `Einige Modelle zeigen markantes Gewitter- oder Sturmpotenzial${window ? ` (${fmtH(window.start)}–${fmtH(window.end)} Uhr)` : ""}, Unsicherheit ${uncertaintyLabel(uncertainty)}.`;
  else if (riskMax >= 20) headline = `Schwache konvektive Signale, ${signaling} von ${series.length} Modellen mit Wetteraktivität.`;

  return {
    modelCount: series.length,
    signalingCount: signaling,
    signalingRatio: ratio,
    signalWindow: window,
    riskMax,
    scoreSpread: spread,
    uncertainty,
    headline,
  };
}

function fmtH(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit" });
}
function uncertaintyLabel(u: ConsensusSummary["uncertainty"]) {
  return u === "low" ? "gering" : u === "mid" ? "mittel" : "erhöht";
}

/** Pro-Modell Aggregat für das Ranking (sortiert nach worstScore desc). */
export interface ModelRankRow {
  model: ModelSeries["model"];
  label: string;
  resolutionKm?: number;
  worstScore: number;
  level: ReturnType<typeof summarizeModelSevere>["level"];
  capeMax: number | null;
  liMin: number | null;
  gustMaxMs: number;
  precipMaxMm: number;
  thunderProbMax: number;
  drivers: string[];
  hourly: HourlyPoint[];
}

export function buildRanking(series: ModelSeries[], now: Date): ModelRankRow[] {
  return series.map((s) => {
    const live = liveHourly(s.hourly, now).slice(0, 24);
    const sum = summarizeModelSevere(live);
    const drivers: string[] = [];
    if (sum.capeMax != null && sum.capeMax >= 800) drivers.push("CAPE");
    if (sum.liMin != null && sum.liMin <= -3) drivers.push("LI");
    if (sum.gustMaxMs >= 18) drivers.push("Böen");
    if (sum.precipMaxMm >= 15) drivers.push("Starkregen");
    if (sum.thunderProbMax >= 0.5) drivers.push("Gewitter");
    // Stundenpeak finden für Verlauf
    const peakHour = live.reduce<{ p: HourlyPoint | null; s: number }>((acc, h) => {
      const sc = severeScore(h).value;
      return sc > acc.s ? { p: h, s: sc } : acc;
    }, { p: null, s: -1 });
    return {
      model: s.model,
      label: s.label,
      resolutionKm: s.meta.resolutionKm,
      worstScore: sum.worstScore,
      level: sum.level,
      capeMax: sum.capeMax,
      liMin: sum.liMin,
      gustMaxMs: sum.gustMaxMs,
      precipMaxMm: sum.precipMaxMm,
      thunderProbMax: sum.thunderProbMax,
      drivers,
      hourly: live,
      // marker silence
      _peak: peakHour,
    } as ModelRankRow;
  }).sort((a, b) => b.worstScore - a.worstScore);
}

/** Standard-Kernmodelle für den fokussierten Vergleich. */
export const CORE_MODEL_IDS: ModelSeries["model"][] = [
  "icon_d2", "icon_eu", "ecmwf_ifs025", "gfs_seamless",
];
