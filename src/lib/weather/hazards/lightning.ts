/**
 * Lightning-Jump-Erkennung nach Schultz et al. 2009 (vereinfacht).
 *
 * Idee: Die Standardabweichung σ der 2-min-Strike-Raten über die letzten
 * ~10 min bildet eine Baseline. Ein "Jump" liegt vor, wenn die aktuelle
 * Rate die Baseline um mehr als 2 σ übersteigt. Jumps sind ein etablierter
 * Frühindikator für Hagel und Tornado-Genese (~10–15 min Vorlauf).
 *
 * Wir clustern hier nicht erneut, sondern arbeiten auf den Strike-Zeiten,
 * die bereits einer Storm-Zelle zugeordnet sind.
 */

import type { HazardLevel, HazardSource, LightningDiagnosis } from "./types";

export interface LightningInput {
  /** Strike-Zeitstempel (ms) der Zelle, sortiert oder unsortiert. */
  strikeTimes: number[];
  /** Aktuelle Rate in Blitzen/min (zentrales Fenster). */
  currentRatePerMin: number;
  /** Referenzzeit für die Auswertung (default = now). */
  now?: number;
}

const BIN_MS = 2 * 60_000; // 2-min-Bins
const BASELINE_BINS = 5; // 10 min Baseline
const JUMP_SIGMA = 2; // Schwelle nach Schultz

function binRates(times: number[], now: number): number[] {
  // Letzte 6 Bins: bin[0] = aktuell, bin[1..5] = Baseline.
  const counts = new Array<number>(BASELINE_BINS + 1).fill(0);
  for (const t of times) {
    const ageMs = now - t;
    if (ageMs < 0) continue;
    const idx = Math.floor(ageMs / BIN_MS);
    if (idx < counts.length) counts[idx]++;
  }
  // Counts → Rate pro Minute.
  return counts.map((c) => c / (BIN_MS / 60_000));
}

function stddev(values: number[]): { mean: number; sd: number } {
  if (values.length === 0) return { mean: 0, sd: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, sd: Math.sqrt(variance) };
}

function levelFor(rate: number, jumpActive: boolean, sigma: number): HazardLevel {
  if (rate >= 20 || (jumpActive && sigma >= 4)) return "extreme";
  if (rate >= 8 || (jumpActive && sigma >= 3)) return "high";
  if (rate >= 3 || jumpActive) return "elevated";
  if (rate >= 0.5) return "watch";
  return "none";
}

export function diagnoseLightning(input: LightningInput): LightningDiagnosis {
  const now = input.now ?? Date.now();
  const rates = binRates(input.strikeTimes, now);
  const current = rates[0];
  const baseline = rates.slice(1);
  const { mean, sd } = stddev(baseline);

  // σ-Abstand der aktuellen Rate von der Baseline.
  const sigma = sd > 0 ? (current - mean) / sd : current > mean ? 99 : 0;
  const jumpActive = sigma >= JUMP_SIGMA && current > mean + 0.5;

  const reasons: string[] = [`Aktuelle Rate ${input.currentRatePerMin.toFixed(1)} Blitze/min`];
  if (sd > 0) reasons.push(`Baseline ${mean.toFixed(1)} ±${sd.toFixed(1)} (10 min)`);
  if (jumpActive) reasons.push(`Lightning Jump aktiv (${sigma.toFixed(1)} σ über Baseline)`);
  else if (sigma > 1) reasons.push(`Aktivität leicht erhöht (${sigma.toFixed(1)} σ)`);

  const level = levelFor(input.currentRatePerMin, jumpActive, sigma);
  const score = Math.min(
    100,
    Math.round(input.currentRatePerMin * 6 + (jumpActive ? 30 : 0) + Math.max(0, sigma) * 4),
  );

  const sources: HazardSource[] = [
    { label: "Blitzortung (Strike-Stream)" },
    { label: "Schultz-Jump-Algorithmus" },
  ];

  return {
    kind: "lightning",
    level,
    score,
    reasons,
    sources,
    ratePerMin: input.currentRatePerMin,
    jumpSigma: Number.isFinite(sigma) ? Math.round(sigma * 10) / 10 : 0,
    jumpActive,
  };
}
