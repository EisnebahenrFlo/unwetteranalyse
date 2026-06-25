import { destination, distanceKm } from "./geo";
import type { StormCentroidPoint, StormForecastPoint, StormMotion } from "./types";

/**
 * Lineare Extrapolation in 5-min-Schritten bis +60 min.
 * Sigma wächst mit Track-Unsicherheit und Zeit (Diffusion ~ √t).
 */
export function buildForecast(
  centroid: { lat: number; lon: number },
  motion: StormMotion | null,
  history: StormCentroidPoint[],
  horizonMin = 60,
  stepMin = 5,
): { forecast: StormForecastPoint[]; cone: [number, number][] } {
  if (!motion || motion.speedKmh < 1) return { forecast: [], cone: [] };

  // Basis-Sigma aus Streuung der letzten Centroide um die lineare Bewegung.
  let baseSigma = 2;
  if (history.length >= 3) {
    const last = history[history.length - 1];
    let sumSq = 0;
    for (const h of history) {
      const dtMin = (last.time - h.time) / 60_000;
      const expected = destination(
        last,
        motion.speedKmh * (dtMin / 60),
        (motion.bearingDeg + 180) % 360,
      );
      sumSq += distanceKm(expected, h) ** 2;
    }
    baseSigma = Math.max(2, Math.sqrt(sumSq / history.length));
  }
  // Vertrauen reduziert das Sigma (1 = scharf, 0 = unscharf).
  baseSigma *= 2 - motion.confidence;

  const forecast: StormForecastPoint[] = [];
  for (let t = stepMin; t <= horizonMin; t += stepMin) {
    const distKm = motion.speedKmh * (t / 60);
    const pos = destination(centroid, distKm, motion.bearingDeg);
    const sigmaKm = baseSigma + Math.sqrt(t) * 1.2;
    forecast.push({ offsetMin: t, lat: pos.lat, lon: pos.lon, sigmaKm });
  }

  // Cone: links/rechts der Bahn jeweils sigma*2, geschlossener Ring.
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  const perpL = (motion.bearingDeg - 90 + 360) % 360;
  const perpR = (motion.bearingDeg + 90) % 360;
  const start: [number, number] = [centroid.lon, centroid.lat];
  for (const p of forecast) {
    const l = destination({ lat: p.lat, lon: p.lon }, p.sigmaKm * 2, perpL);
    const r = destination({ lat: p.lat, lon: p.lon }, p.sigmaKm * 2, perpR);
    left.push([l.lon, l.lat]);
    right.push([r.lon, r.lat]);
  }
  const cone: [number, number][] = forecast.length
    ? [start, ...right, ...left.reverse(), start]
    : [];

  return { forecast, cone };
}
