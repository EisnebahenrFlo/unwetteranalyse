import type { EnsembleRaw } from "../sources/open-meteo-ensemble";

export interface EnsemblePoint {
  time: string;
  capeMedian: number | null;
  capeP10: number | null;
  capeP90: number | null;
  capeBand: [number, number] | null;
  pThunder: number;
  pStrong: number;
  pHeavyRain: number;
  pStorm: number;
  members: number;
}

export interface EnsembleSummary {
  model: string;
  memberCount: number;
  peakThunder: number;
  peakWindow: { start: string; end: string } | null;
  headline: string;
}

/** Sammelt Basisfeld + alle _memberNN Spalten in stabiler Reihenfolge. */
export function collectMembers(
  hourly: Record<string, unknown> | undefined,
  base: string,
): number[][] {
  if (!hourly) return [];
  const re = new RegExp(`^${base}(?:_member(\\d+))?$`);
  const matched: { key: string; order: number }[] = [];
  for (const key of Object.keys(hourly)) {
    const m = key.match(re);
    if (!m) continue;
    matched.push({ key, order: m[1] ? Number(m[1]) : -1 });
  }
  matched.sort((a, b) => a.order - b.order);
  const out: number[][] = [];
  for (const { key } of matched) {
    const arr = hourly[key];
    if (Array.isArray(arr)) out.push(arr as number[]);
  }
  return out;
}

export function quantile(sortedVals: number[], q: number): number | null {
  if (sortedVals.length === 0) return null;
  if (sortedVals.length === 1) return sortedVals[0];
  const pos = (sortedVals.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedVals[lo];
  return sortedVals[lo] + (sortedVals[hi] - sortedVals[lo]) * (pos - lo);
}

export function p(values: number[], pred: (v: number) => boolean): number {
  if (values.length === 0) return 0;
  let n = 0;
  for (const v of values) if (pred(v)) n++;
  return n / values.length;
}

function pct(x: number): number {
  return Math.round(x * 100);
}

function fmtWindowLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const day = s.toLocaleDateString("de-DE", { weekday: "short" });
  const sH = s.toLocaleTimeString("de-DE", { hour: "2-digit" });
  const eH = e.toLocaleTimeString("de-DE", { hour: "2-digit" });
  return sameDay ? ` ${day} ${sH}–${eH} Uhr` : ` ab ${day} ${sH} Uhr`;
}

export function analyzeEnsemble(
  raw: EnsembleRaw,
  now: Date,
): { timeline: EnsemblePoint[]; summary: EnsembleSummary } {
  const hourly = raw.hourly;
  const times: string[] = Array.isArray(hourly?.time) ? (hourly!.time as string[]) : [];
  const capeM = collectMembers(hourly as Record<string, unknown> | undefined, "cape");
  const precM = collectMembers(hourly as Record<string, unknown> | undefined, "precipitation");
  const gustM = collectMembers(hourly as Record<string, unknown> | undefined, "wind_gusts_10m");

  const nowMs = now.getTime();
  const timeline: EnsemblePoint[] = [];
  const maxAhead = 120;

  for (let i = 0; i < times.length && timeline.length < maxAhead; i++) {
    const t = times[i];
    if (!t) continue;
    const ts = new Date(t).getTime();
    if (!Number.isFinite(ts) || ts < nowMs - 30 * 60 * 1000) continue;

    const capeVals: number[] = [];
    for (const arr of capeM) {
      const v = arr[i];
      if (v != null && Number.isFinite(v)) capeVals.push(Number(v));
    }
    const precVals: number[] = [];
    for (const arr of precM) {
      const v = arr[i];
      if (v != null && Number.isFinite(v)) precVals.push(Number(v));
    }
    const gustVals: number[] = [];
    for (const arr of gustM) {
      const v = arr[i];
      if (v != null && Number.isFinite(v)) gustVals.push(Number(v));
    }

    const sortedCape = [...capeVals].sort((a, b) => a - b);
    const capeMedian = quantile(sortedCape, 0.5);
    const capeP10 = quantile(sortedCape, 0.1);
    const capeP90 = quantile(sortedCape, 0.9);
    const capeBand: [number, number] | null =
      capeP10 != null && capeP90 != null ? [capeP10, Math.max(0, capeP90 - capeP10)] : null;

    timeline.push({
      time: t,
      capeMedian,
      capeP10,
      capeP90,
      capeBand,
      pThunder: p(capeVals, (v) => v >= 500),
      pStrong: p(capeVals, (v) => v >= 1500),
      pHeavyRain: p(precVals, (v) => v >= 15),
      pStorm: p(gustVals, (v) => v >= 25),
      members: capeVals.length,
    });
  }

  const memberCount = timeline.reduce((m, p) => Math.max(m, p.members), 0);
  const peakThunder = timeline.reduce((m, p) => Math.max(m, p.pThunder), 0);

  // längstes zusammenhängendes Fenster mit pThunder ≥ 0.3
  let peakWindow: { start: string; end: string } | null = null;
  let bestLen = 0;
  let i = 0;
  while (i < timeline.length) {
    if (timeline[i].pThunder >= 0.3) {
      let j = i;
      while (j + 1 < timeline.length && timeline[j + 1].pThunder >= 0.3) j++;
      const len = j - i + 1;
      if (len > bestLen) {
        bestLen = len;
        peakWindow = { start: timeline[i].time, end: timeline[j].time };
      }
      i = j + 1;
    } else {
      i++;
    }
  }

  const windowLabel = peakWindow ? fmtWindowLabel(peakWindow.start, peakWindow.end) : "";
  let headline = "Geringe Gewitterneigung im Ensemble.";
  if (peakThunder >= 0.6)
    headline = `Hohe Gewitterwahrscheinlichkeit (${pct(peakThunder)}% der Member)${windowLabel}.`;
  else if (peakThunder >= 0.3)
    headline = `Erhöhte Gewitterneigung (${pct(peakThunder)}% der Member)${windowLabel}.`;

  const summary: EnsembleSummary = {
    model: "icon_eu_eps",
    memberCount,
    peakThunder,
    peakWindow,
    headline,
  };

  return { timeline, summary };
}