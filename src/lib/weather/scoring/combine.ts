/** Geteilte Achsen-Kombination. Single Source für alle Score-Horizonte. */
const W_NOWCAST = { rain: 0.35, wind: 0.2, thunder: 0.3, convection: 0.15 };
const W_TODAY = { rain: 0.22, wind: 0.2, thunder: 0.3, convection: 0.28 };

export function combineNowcast(
  rain: number,
  wind: number,
  thunder: number,
  convection: number,
): number {
  const w = W_NOWCAST;
  const linear = rain * w.rain + wind * w.wind + thunder * w.thunder + convection * w.convection;
  const subs = [rain, wind, thunder, convection];
  let score = Math.max(linear, Math.max(...subs) * 0.85);
  // Multi-Source-Gate: kritisch (>=60) braucht >=2 korrelierende Achsen (>=45).
  const corroborating = subs.filter((v) => v >= 45).length;
  if (score >= 60 && corroborating < 2) score = Math.min(score, 59);
  return Math.round(score);
}

export function combineToday(
  rain: number,
  wind: number,
  thunder: number,
  convection: number,
): number {
  const w = W_TODAY;
  const linear = rain * w.rain + wind * w.wind + thunder * w.thunder + convection * w.convection;
  const maxSub = Math.max(rain, wind, thunder, convection);
  return Math.round(Math.max(linear, maxSub * 0.8));
}