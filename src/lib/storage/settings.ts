export type WindUnit = "ms" | "kmh" | "bft";
export type TempUnit = "C" | "F";
export type ThemeMode = "light" | "dark" | "auto";
export type StormAlertLevel = "watch" | "serious" | "severe";
export type HazardMinLevel = "watch" | "elevated" | "high" | "extreme";

export interface Settings {
  windUnit: WindUnit;
  tempUnit: TempUnit;
  theme: ThemeMode;
  defaultMapLayers: string[];
  storm: {
    enabled: boolean;
    alertEtaMin: number;
    alertLevel: StormAlertLevel;
    showLayer: boolean;
    showHailCores: boolean;
  };
  hazards: {
    enabled: boolean;
    minLevel: HazardMinLevel;
    alertEtaMin: number;
    cooldownMin: number;
    hitKm: number;
    enableHail: boolean;
    enableFlood: boolean;
    retentionDays: number;
  };
}

const KEY = "meteoflo.settings.v2";

export const DEFAULT_SETTINGS: Settings = {
  windUnit: "kmh",
  tempUnit: "C",
  theme: "auto",
  defaultMapLayers: ["radar"],
  storm: {
    enabled: true,
    alertEtaMin: 45,
    alertLevel: "serious",
    showLayer: true,
    showHailCores: true,
  },
  hazards: {
    enabled: true,
    minLevel: "elevated",
    alertEtaMin: 45,
    cooldownMin: 10,
    hitKm: 10,
    enableHail: true,
    enableFlood: true,
    retentionDays: 14,
  },
};

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // Migration: alter Wert "system" -> "auto"
    const theme = (parsed.theme as string) === "system" ? "auto" : parsed.theme;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      theme: (theme as ThemeMode) ?? DEFAULT_SETTINGS.theme,
      storm: { ...DEFAULT_SETTINGS.storm, ...(parsed.storm ?? {}) },
      hazards: { ...DEFAULT_SETTINGS.hazards, ...(parsed.hazards ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setSettings(next: Settings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("meteoflo:settings-changed"));
}