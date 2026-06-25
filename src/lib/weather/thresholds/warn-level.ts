import type { AlertSeverity } from "../types";

/** Amtliche DWD-Warnstufe. Quelle: dwd.de Warnkriterien. */
export type WarnLevel = 1 | 2 | 3 | 4;

/** Anzeige-Stufe inkl. 0 = keine Warnung. Gemeinsame Währung für alle Severity-Skalen. */
export type DisplayLevel = 0 | WarnLevel;

export interface WarnLevelInfo {
  level: WarnLevel;
  name: string;
  color: string;
}

export const WARN_LEVEL: Record<WarnLevel, WarnLevelInfo> = {
  1: { level: 1, name: "Wetterwarnung", color: "Gelb" },
  2: { level: 2, name: "Markantes Wetter", color: "Orange" },
  3: { level: 3, name: "Unwetterwarnung", color: "Rot" },
  4: { level: 4, name: "Extremes Unwetter", color: "Violett" },
};

export const WARN_DISPLAY: Record<DisplayLevel, { name: string; color: string }> = {
  0: { name: "keine Warnung", color: "Grün" },
  1: WARN_LEVEL[1],
  2: WARN_LEVEL[2],
  3: WARN_LEVEL[3],
  4: WARN_LEVEL[4],
};

/** CAP-Severity (DWD/MeteoAlarm) → DWD-Stufe. */
export function capSeverityToLevel(s?: string): WarnLevel {
  switch ((s ?? "").toLowerCase()) {
    case "extreme":
      return 4;
    case "severe":
      return 3;
    case "moderate":
      return 2;
    default:
      return 1;
  }
}

export function severityToLevel(s: AlertSeverity): WarnLevel {
  return s === "extreme" ? 4 : s === "severe" ? 3 : s === "moderate" ? 2 : 1;
}

export function capSeverityToAlert(s?: string): AlertSeverity {
  switch ((s ?? "").toLowerCase()) {
    case "extreme":
      return "extreme";
    case "severe":
      return "severe";
    case "moderate":
      return "moderate";
    default:
      return "minor";
  }
}
