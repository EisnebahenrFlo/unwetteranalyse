/**
 * Abgeleitete meteorologische Kennwerte.
 * Quelle Open-Meteo Pressure-Level-API (850/700/500 hPa).
 */

import type { HourlyPoint } from "../types";

export interface DerivedParams {
  kIndex: number | null;
  totalTotals: number | null;
  dewPointSpreadK: number | null;
  sultriness: "trocken" | "angenehm" | "schwül" | "drückend";
  lowLevelShearMs: number | null;
}

/**
 * K-Index = (T850 - T500) + Td850 - (T700 - Td700)
 */
export function kIndex(p: HourlyPoint): number | null {
  const t850 = p.temperature850hPa,
    t700 = p.temperature700hPa,
    t500 = p.temperature500hPa;
  const td850 = p.dewPoint850hPa,
    td700 = p.dewPoint700hPa;
  if ([t850, t700, t500, td850, td700].some((v) => v == null)) return null;
  return t850! - t500! + td850! - (t700! - td700!);
}

/**
 * Total Totals = T850 + Td850 - 2·T500
 */
export function totalTotals(p: HourlyPoint): number | null {
  const t850 = p.temperature850hPa,
    t500 = p.temperature500hPa,
    td850 = p.dewPoint850hPa;
  if ([t850, t500, td850].some((v) => v == null)) return null;
  return t850! + td850! - 2 * t500!;
}

export function dewPointSpread(p: HourlyPoint): number | null {
  if (p.dewPointC == null || p.temperatureC == null) return null;
  return p.temperatureC - p.dewPointC;
}

export function sultrinessFrom(p: HourlyPoint): DerivedParams["sultriness"] {
  const td = p.dewPointC;
  if (td == null) return "angenehm";
  if (td >= 20) return "drückend";
  if (td >= 16) return "schwül";
  if (td >= 10) return "angenehm";
  return "trocken";
}

/** Skalarer Low-Level-Shear-Proxy 10 m ↔ 180 m. */
export function lowLevelShearMs(p: HourlyPoint): number | null {
  const a = p.windSpeedMs,
    b = p.windSpeed180mMs;
  if (a == null || b == null) return null;
  let base = Math.abs(b - a);
  if (p.windDirection80mDeg != null && p.windDirection180mDeg != null) {
    const diff = Math.abs(((p.windDirection180mDeg - p.windDirection80mDeg + 540) % 360) - 180);
    base += (diff / 180) * 3;
  }
  return base;
}

export function deriveAll(p: HourlyPoint): DerivedParams {
  return {
    kIndex: kIndex(p),
    totalTotals: totalTotals(p),
    dewPointSpreadK: dewPointSpread(p),
    sultriness: sultrinessFrom(p),
    lowLevelShearMs: lowLevelShearMs(p),
  };
}

/** Heuristische Gewitterwahrscheinlichkeit aus CAPE, LI, K, TT, Code. */
export function thunderProbability(p: HourlyPoint): number {
  let prob = 0;
  if (p.cape != null) {
    if (p.cape >= 2500) prob = Math.max(prob, 0.95);
    else if (p.cape >= 1500) prob = Math.max(prob, 0.8);
    else if (p.cape >= 800) prob = Math.max(prob, 0.55);
    else if (p.cape >= 300) prob = Math.max(prob, 0.3);
  }
  if (p.liftedIndex != null) {
    if (p.liftedIndex <= -6) prob = Math.max(prob, 0.9);
    else if (p.liftedIndex <= -3) prob = Math.max(prob, 0.7);
    else if (p.liftedIndex <= -1) prob = Math.max(prob, 0.45);
  }
  const k = kIndex(p);
  if (k != null) {
    if (k >= 40) prob = Math.max(prob, 0.85);
    else if (k >= 30) prob = Math.max(prob, 0.65);
    else if (k >= 25) prob = Math.max(prob, 0.4);
  }
  const tt = totalTotals(p);
  if (tt != null) {
    if (tt >= 55) prob = Math.max(prob, 0.85);
    else if (tt >= 50) prob = Math.max(prob, 0.65);
    else if (tt >= 44) prob = Math.max(prob, 0.4);
  }
  if (p.convectiveInhibition != null && p.convectiveInhibition <= -150) prob *= 0.5;
  if (p.weatherCode != null && p.weatherCode >= 95) prob = Math.max(prob, 0.85);
  return Math.min(1, prob);
}
