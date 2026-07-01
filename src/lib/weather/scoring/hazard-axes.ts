import type { AlertSeverity, HourlyPoint } from "../types";

/** Hagel-Risiko: Modellsignal (WMO 96/99) oder CAPE + LI/Freezing-Level-Proxy. */
export function hailRisk(p: HourlyPoint): AlertSeverity | "none" {
  const code = p.weatherCode;
  if (code === 99) return "severe";
  if (code === 96) return "moderate";
  if (p.cape == null) return "none";
  const li = p.liftedIndex;
  const fl = p.freezingLevelM ?? 4000;
  if (li != null) {
    if (p.cape >= 2000 && li <= -5 && fl <= 3500) return "severe";
    if (p.cape >= 1500 && li <= -3) return "moderate";
    if (p.cape >= 800 && li <= -2) return "minor";
    return "none";
  }
  if (p.cape >= 2500 && fl <= 3500) return "moderate";
  if (p.cape >= 1500 && fl <= 3800) return "minor";
  return "none";
}

/** Sturmböen-/Downburst-Risiko in konvektiver Lage. */
export function downburstRisk(p: HourlyPoint): AlertSeverity | "none" {
  const gust = p.windGustMs ?? 0;
  const cape = p.cape ?? 0;
  if (cape >= 1000 && gust >= 25) return "severe";
  if (cape >= 800 && gust >= 20) return "moderate";
  if (cape >= 500 && gust >= 16) return "minor";
  return "none";
}

/**
 * Score-Untergrenze aus expliziten Gefahren-Signalen (0–100).
 * Nur HARTE Hagelmeldungen (WMO 96/99) und böengestützte Downbursts heben an.
 * Rein aus CAPE/LI abgeleiteter Hagel gibt KEINEN Floor (steckt schon in
 * thunder/convection — sonst Doppelzählung + Gate-Umgehung).
 */
export function hazardBoostFloor(p: HourlyPoint): number {
  let floor = 0;
  if (p.weatherCode === 99) floor = Math.max(floor, 60);
  else if (p.weatherCode === 96) floor = Math.max(floor, 40);
  const db = downburstRisk(p);
  if (db === "severe") floor = Math.max(floor, 60);
  else if (db === "moderate") floor = Math.max(floor, 40);
  return floor;
}