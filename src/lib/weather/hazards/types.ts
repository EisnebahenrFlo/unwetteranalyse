/**
 * Domain-Typen für die Hazard-Engine.
 * Zwei Hazards: Hagel und Sturzflut. Lightning-Diagnose wurde entfernt,
 * Hagel-Diagnose nutzt jetzt Radar-Top-dBZ + Open-Meteo-Umgebung.
 */

export type HazardKind = "hail" | "flood";

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
  label: string;
  validFor?: string;
}

export interface HazardDiagnosis {
  kind: HazardKind;
  level: HazardLevel;
  score: number;
  reasons: string[];
  sources: HazardSource[];
}

export interface HailDiagnosis extends HazardDiagnosis {
  kind: "hail";
  pohPercent: number;
  meshsCm: number;
  deltaHkm: number | null;
}

export interface FloodDiagnosis extends HazardDiagnosis {
  kind: "flood";
  rrMm: { h1: number; h3: number; h6: number; h24: number };
  returnYears: number | null;
  ffi: number;
}

export interface HazardCellReport {
  cellId: string;
  topLevel: HazardLevel;
  topScore: number;
  hail: HailDiagnosis;
  flood: FloodDiagnosis;
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
  reasons: string[];
  occurredAt: number;
}

export interface HazardThresholds {
  minLevel: HazardLevel;
  alertEtaMin: number;
  cooldownMin: number;
  hitKm: number;
  enableHail: boolean;
  enableFlood: boolean;
}

export const DEFAULT_HAZARD_THRESHOLDS: HazardThresholds = {
  minLevel: "elevated",
  alertEtaMin: 45,
  cooldownMin: 10,
  hitKm: 10,
  enableHail: true,
  enableFlood: true,
};