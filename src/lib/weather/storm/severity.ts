import type { StormEnvironment, StormSeverity, StormSeverityBreakdown } from "./types";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Heuristischer Severity-Score 0..100.
 * Quellen: Strike-Rate, Trend, räumliche Konzentration, CAPE/LI als Umgebungs-Proxy.
 * Keine ML, alles transparent und nachvollziehbar.
 */
export function scoreCell(input: {
  strikeRatePerMin: number;
  strikeRateTrend: number;
  radiusKm: number;
  strikeCount: number;
  env: StormEnvironment;
}): StormSeverityBreakdown {
  const reasons: string[] = [];
  let score = 0;

  const rate = input.strikeRatePerMin;
  const rateScore = clamp(rate * 8, 0, 40);
  score += rateScore;
  if (rate >= 1) reasons.push(`${rate.toFixed(1)} Blitze/min`);

  const trend = input.strikeRateTrend;
  if (trend > 1.3) {
    const t = clamp((trend - 1) * 15, 0, 15);
    score += t;
    reasons.push(`Aktivität verstärkt sich (×${trend.toFixed(1)})`);
  } else if (trend < 0.7 && rate > 0) {
    score -= clamp((1 - trend) * 10, 0, 10);
    reasons.push("Aktivität schwächt ab");
  }

  // Räumliche Konzentration: kleiner Cluster mit hoher Rate = intensiver Kern.
  if (input.strikeCount >= 10 && input.radiusKm > 0) {
    const density = input.strikeCount / Math.max(1, input.radiusKm);
    const dScore = clamp(density * 1.5, 0, 10);
    score += dScore;
    if (density > 2) reasons.push("kompakter Kern");
  }

  if (input.env.cape != null) {
    const cape = input.env.cape;
    score += clamp(cape / 80, 0, 20);
    const tag = input.env.source === "cell" ? "lokal" : "Region";
    if (cape >= 1500) reasons.push(`CAPE ${Math.round(cape)} J/kg (${tag})`);
    else if (cape >= 500) reasons.push(`CAPE moderat ${Math.round(cape)} (${tag})`);
  }
  if (input.env.liftedIndex != null) {
    const li = input.env.liftedIndex;
    if (li <= -2) {
      score += clamp(-li * 4, 0, 15);
      const tag = input.env.source === "cell" ? "lokal" : "Region";
      reasons.push(`LI ${li.toFixed(1)} (${tag})`);
    }
  }

  score = clamp(Math.round(score), 0, 100);
  const level: StormSeverity =
    score >= 70 ? "severe" : score >= 45 ? "serious" : score >= 22 ? "watch" : "calm";

  if (reasons.length === 0) reasons.push("schwache Aktivität");
  return { score, level, reasons };
}