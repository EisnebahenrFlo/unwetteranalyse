/**
 * Teilrisiken (0–100) für Regen, Wind, Gewitter, Konvektion sowie Datenvertrauen.
 * Jeder Teilscore ist erklärbar: contributors[] enthält die einzelnen Beiträge.
 */

import type { HourlyPoint } from "../types";
import { bandFromScore, type Band } from "./labels";
import {
  cinDamping,
  clamp,
  normCape,
  normGustKmh,
  normKIndex,
  normLiftedIndex,
  normRainMmH,
  normThunderProb,
  normTotalTotals,
  normWindKmh,
} from "./normalize";
import { kIndex, thunderProbability, totalTotals } from "./derived";

export interface Contributor {
  label: string;
  raw: string;
  points: number;
}

export interface Subscore {
  value: number;
  band: Band;
  contributors: Contributor[];
  confidence: number;
}

function build(value: number, contributors: Contributor[], confidence = 80): Subscore {
  const v = Math.round(clamp(value));
  return { value: v, band: bandFromScore(v), contributors, confidence };
}

function pickTop(c: Contributor[]) {
  return c.filter((x) => x.points > 0).sort((a, b) => b.points - a.points);
}

export function rainSubscore(p: HourlyPoint): Subscore {
  const c: Contributor[] = [];
  const mm = p.precipitationMm ?? 0;
  const prob = p.precipitationProbability ?? 0;
  const rPts = normRainMmH(mm);
  if (rPts > 0) c.push({ label: "Niederschlagsrate", raw: `${mm.toFixed(1)} mm/h`, points: rPts });
  const probPts = (prob / 100) * 12 * (mm < 0.5 ? 1 : 0.4);
  if (probPts > 0.5)
    c.push({ label: "Niederschlagswahrscheinl.", raw: `${prob.toFixed(0)} %`, points: probPts });
  const total = c.reduce((s, x) => s + x.points, 0);
  return build(total, pickTop(c), p.precipitationMm != null ? 85 : 50);
}

export function windSubscore(p: HourlyPoint): Subscore {
  const c: Contributor[] = [];
  const gKmh = (p.windGustMs ?? 0) * 3.6;
  const wKmh = (p.windSpeedMs ?? 0) * 3.6;
  const gPts = normGustKmh(gKmh);
  if (gPts > 0) c.push({ label: "Spitzenböen", raw: `${gKmh.toFixed(0)} km/h`, points: gPts });
  const wPts = normWindKmh(wKmh) * 0.4;
  if (wPts > 0.5) c.push({ label: "Mittelwind", raw: `${wKmh.toFixed(0)} km/h`, points: wPts });
  const total = c.reduce((s, x) => s + x.points, 0);
  return build(total, pickTop(c), p.windGustMs != null ? 85 : 55);
}

export function thunderSubscore(
  p: HourlyPoint,
  opts?: { radarTopDbz?: number | null },
): Subscore {
  const c: Contributor[] = [];
  const tp = thunderProbability(p);
  const tpPts = normThunderProb(tp) * 0.6;
  if (tpPts > 0.5)
    c.push({ label: "Gewitterwahrscheinl.", raw: `${Math.round(tp * 100)} %`, points: tpPts });
  if (p.weatherCode != null && p.weatherCode >= 95) {
    c.push({ label: "Modell meldet Gewitter", raw: `Code ${p.weatherCode}`, points: 15 });
  }
  if (opts?.radarTopDbz != null && opts.radarTopDbz >= 40) {
    const precipMm = p.precipitationMm ?? 0;
    // >=40 dBZ impliziert messbaren Niederschlag (Z-R). Fehlt der lokal,
    // ist das Echo nicht vertrauenswürdig (Fremdzelle/Stale) -> kein Beitrag.
    if (precipMm >= 0.5) {
      const pts = Math.min(40, (opts.radarTopDbz - 35) * 3);
      c.push({
        label: "Radar-Echo",
        raw: `${Math.round(opts.radarTopDbz)} dBZ`,
        points: pts,
      });
    } else {
      c.push({
        label: "Radar-Echo (unbestätigt)",
        raw: `${Math.round(opts.radarTopDbz)} dBZ · kein lokaler Niederschlag`,
        points: 0,
      });
    }
  }
  const total = c.reduce((s, x) => s + x.points, 0);
  const conf =
    (p.cape != null ? 30 : 0) +
    (p.liftedIndex != null ? 25 : 0) +
    (opts?.radarTopDbz != null ? 25 : 0) +
    20;
  return build(total, pickTop(c), Math.min(100, conf));
}

export function convectionSubscore(p: HourlyPoint): Subscore {
  const c: Contributor[] = [];
  const damp = cinDamping(p.convectiveInhibition);
  if (p.cape != null) {
    const pts = normCape(p.cape) * 0.45 * damp;
    if (pts > 0.5) c.push({ label: "CAPE", raw: `${p.cape.toFixed(0)} J/kg`, points: pts });
  }
  if (p.liftedIndex != null) {
    const pts = normLiftedIndex(p.liftedIndex) * 0.3 * damp;
    if (pts > 0.5) c.push({ label: "Lifted Index", raw: p.liftedIndex.toFixed(1), points: pts });
  }
  const k = kIndex(p);
  if (k != null) {
    const pts = normKIndex(k) * 0.15 * damp;
    if (pts > 0.5) c.push({ label: "K-Index", raw: k.toFixed(1), points: pts });
  }
  const tt = totalTotals(p);
  if (tt != null) {
    const pts = normTotalTotals(tt) * 0.1 * damp;
    if (pts > 0.5) c.push({ label: "Total Totals", raw: tt.toFixed(1), points: pts });
  }
  if (p.convectiveInhibition != null && p.convectiveInhibition >= 100) {
    c.push({ label: "CIN dämpft", raw: `${p.convectiveInhibition.toFixed(0)} J/kg`, points: 0 });
  }
  const total = c.reduce((s, x) => s + x.points, 0);
  const fields = [p.cape, p.liftedIndex, k, tt].filter((v) => v != null).length;
  const conf = 30 + fields * 15;
  return build(total, pickTop(c), Math.min(100, conf));
}

export interface DataContextInput {
  hasMinutely: boolean;
  hasUpperLevels: boolean;
  hasConvective: boolean;
  liveObsAgeMinutes: number | null;
  radarAgeMinutes: number | null;
  modelObsConsistent: boolean | null;
  radarPrecipConflict?: boolean;
}

export function dataConfidence(input: DataContextInput): Subscore {
  const c: Contributor[] = [];
  let score = 35;
  if (input.hasConvective) {
    score += 18;
    c.push({ label: "Konvektive Felder", raw: "CAPE/LI", points: 18 });
  }
  if (input.hasUpperLevels) {
    score += 12;
    c.push({ label: "Höhenwerte", raw: "850/700/500 hPa", points: 12 });
  }
  if (input.hasMinutely) {
    score += 12;
    c.push({ label: "Minutendaten", raw: "15-min Raster", points: 12 });
  }
  if (input.liveObsAgeMinutes != null) {
    const pts = input.liveObsAgeMinutes <= 30 ? 12 : input.liveObsAgeMinutes <= 90 ? 6 : 0;
    score += pts;
    c.push({
      label: "Live-Beobachtung",
      raw: `${Math.round(input.liveObsAgeMinutes)} min alt`,
      points: pts,
    });
  } else {
    c.push({ label: "Live-Beobachtung", raw: "fehlt", points: 0 });
  }
  if (input.radarAgeMinutes != null) {
    const pts = input.radarAgeMinutes <= 10 ? 14 : input.radarAgeMinutes <= 25 ? 8 : 0;
    score += pts;
    c.push({
      label: "DWD-Radar",
      raw: `${Math.round(input.radarAgeMinutes)} min alt`,
      points: pts,
    });
  } else {
    c.push({ label: "DWD-Radar", raw: "keine Frische bekannt", points: 0 });
  }
  if (input.modelObsConsistent === false) {
    score -= 15;
    c.push({ label: "Modell ↔ Live", raw: "abweichend", points: -15 });
  }
  if (input.modelObsConsistent === true) {
    score += 5;
    c.push({ label: "Modell ↔ Live", raw: "konsistent", points: 5 });
  }
  if (input.radarPrecipConflict) {
    score -= 25;
    c.push({ label: "Radar ↔ Niederschlag", raw: "widersprüchlich", points: -25 });
  }
  score = Math.max(0, Math.min(100, score));
  return { value: Math.round(score), band: bandFromScore(score), contributors: c, confidence: 100 };
}