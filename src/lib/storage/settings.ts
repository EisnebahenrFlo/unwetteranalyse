export type WindUnit = "ms" | "kmh" | "bft";
export type TempUnit = "C" | "F";
export type ThemeMode = "light" | "dark" | "system";
export type StormAlertLevel = "watch" | "serious" | "severe";

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
  };
}

const KEY = "meteoflo.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  windUnit: "kmh",
  tempUnit: "C",
  theme: "light",
  defaultMapLayers: ["radar"],
  storm: {
    enabled: true,
    alertEtaMin: 45,
    alertLevel: "serious",
    showLayer: true,
  },
};

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      storm: { ...DEFAULT_SETTINGS.storm, ...(parsed.storm ?? {}) },
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
