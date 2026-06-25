import type { StormSeverity } from "@/lib/weather/storm/types";

/**
 * Farbtöne für Severity. Bewusst ruhig gewählt, rote Tönung nur ab "severe".
 * Kein dramatisches Pink/Magenta.
 */
export const SEVERITY_COLOR: Record<StormSeverity, string> = {
  calm: "#64748b",      // slate-500
  watch: "#f59e0b",     // amber-500
  serious: "#f97316",   // orange-500
  severe: "#dc2626",    // red-600
  extreme: "#7c3aed",   // violet-600
};

export const SEVERITY_LABEL: Record<StormSeverity, string> = {
  calm: "ruhig",
  watch: "beobachten",
  serious: "ernst",
  severe: "schwer",
  extreme: "extrem",
};

/** Kompakte Großbuchstaben-Labels für Karten-Marker. */
export const SEVERITY_BADGE: Record<StormSeverity, string> = {
  calm: "RUHIG",
  watch: "BEOBACHTEN",
  serious: "MARKANT",
  severe: "UNWETTER",
  extreme: "EXTREM",
};

export const SEVERITY_TONE: Record<StormSeverity, string> = {
  calm: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  watch: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  serious: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  severe: "bg-red-500/15 text-red-700 dark:text-red-300",
  extreme: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};