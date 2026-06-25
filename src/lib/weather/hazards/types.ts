/**
 * Domain-Typen für die Hazard-Engine.
 * Drei Hazards: Hagel, Sturzflut, Blitz (qualitativ).
 * Jede Diagnose ist nachvollziehbar (reasons[]) und liefert eine 0..100-Score
 * plus diskrete Stufe. Quellen werden explizit benannt, damit klar ist,
 * was Messung vs. Modellableitung vs. Heuristik ist.
 */

export type HazardKind = "hail" | "flood" | "lightning";

export type HazardLevel = "none" | "watch" | "elevated" | "high" | "extreme";

import type { DisplayLevel } from "../thresholds/warn-level";

/** HazardLevel → gemeinsame DWD-Anzeigestufe. */
export const hazardToLevel = (l: HazardLevel): DisplayLevel =>
  l === "extreme" ? 4 : l === "high" ? 3 : l === "elevated" ? 2 : l === "watch" ? 1 : 0;

export const HAZARD_RANK: Record<HazardLevel, number> = {
  none: 0,
  watch: 1,
  elevated: 2,
  high: 3,
  extreme: 4,
};

export interface HazardSource {
  /** Kurzlabel, z.B. "Open-Meteo CAPE", "Blitzortung", "Open-Meteo RR1h". */
  label: string;
  /** Modell-/Beobachtungszeit (ISO oder leer). */
  validFor?: string;
}

export interface HazardDiagnosis {
  kind: HazardKind;
  level: HazardLevel;
  score: number;
  /** Kurze, sachliche Bullet-Punkte für UI. */
  reasons: string[];
  /** Welche Datenquellen sind in dieses Ergebnis eingegangen? */
  sources: HazardSource[];
}

export interface HailDiagnosis extends HazardDiagnosis {
  kind: "hail";
  /** Probability of Hail in % (0..100). */
  pohPercent: number;
  /** Maximum Expected Severe Hail Size (cm). */
  meshsCm: number;
  /** Vertikaler Abstand H45 (Echo-Top-Proxy) über Freezing Level (km). */
  deltaHkm: number | null;
}

export interface FloodDiagnosis extends HazardDiagnosis {
  kind: "flood";
  /** Gemessene/erwartete Summe in mm pro Fenster. */
  rrMm: { h1: number; h3: number; h6: number; h24: number };
  /** Geschätzte Wiederkehrzeit in Jahren (max über alle Fenster), null wenn unter Schwelle. */
  returnYears: number | null;
  /** Flash-Flood-Index 0..100. */
  ffi: number;
}

export interface LightningDiagnosis extends HazardDiagnosis {
  kind: "lightning";
  /** Aktuelle Rate (Blitze/min) im Cell-Fenster. */
  ratePerMin: number;
  /** Schultz-Jump σ (Standardabweichungen über Baseline). */
  jumpSigma: number;
  /** True, wenn aktuell ein Lightning Jump läuft. */
  jumpActive: boolean;
}

/** Ein Snapshot pro Storm-Zelle: alle drei Hazards plus Aggregat. */
export interface HazardCellReport {
  cellId: string;
  /** Höchste Stufe über alle Hazards. */
  topLevel: HazardLevel;
  /** Höchster Score über alle Hazards. */
  topScore: number;
  hail: HailDiagnosis;
  flood: FloodDiagnosis;
  lightning: LightningDiagnosis;
}

export interface HazardAlert {
  /** Stabiler Key: `${cellId}|${favoriteId}|${kind}`. */
  id: string;
  cellId: string;
  favoriteId: string;
  favoriteName: string;
  kind: HazardKind;
  level: HazardLevel;
  score: number;
  etaMin: number;
  distanceKm: number;
  headline: string;
  createdAt: number;
  updatedAt: number;
}

export interface HazardHistoryEvent {
  id: string;
  favoriteId: string;
  cellId: string;
  kind: HazardKind;
  level: HazardLevel;
  score: number;
  headline: string;
  /** Detail-Strings aus der Diagnose, für die Snapshot-Anzeige. */
  reasons: string[];
  occurredAt: number;
}

export interface HazardThresholds {
  /** Mindeststufe für Alerts pro Hazard. */
  minLevel: HazardLevel;
  /** ETA-Fenster (min). */
  alertEtaMin: number;
  /** Cooldown pro favorite × kind (min). */
  cooldownMin: number;
  /** Treffer-Radius um Favorit (km). */
  hitKm: number;
  /** Hazard-Toggles. */
  enableHail: boolean;
  enableFlood: boolean;
  enableLightning: boolean;
}

export const DEFAULT_HAZARD_THRESHOLDS: HazardThresholds = {
  minLevel: "elevated",
  alertEtaMin: 45,
  cooldownMin: 10,
  hitKm: 10,
  enableHail: true,
  enableFlood: true,
  enableLightning: true,
};
