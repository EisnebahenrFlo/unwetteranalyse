export type WindUnit = "ms" | "kmh" | "bft";
export type TempUnit = "C" | "F";
export type ThemeMode = "light" | "dark" | "system";

export interface Settings {
  windUnit: WindUnit;
  tempUnit: TempUnit;
  theme: ThemeMode;
  defaultMapLayers: string[];
}

const KEY = "meteoflo.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  windUnit: "kmh",
  tempUnit: "C",
  theme: "light",
  defaultMapLayers: ["radar"],
};

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setSettings(next: Settings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("meteoflo:settings-changed"));
}
