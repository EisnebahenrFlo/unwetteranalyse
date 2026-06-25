import type { HazardKind, HazardLevel } from "@/lib/weather/hazards/types";

export const HAZARD_COLOR: Record<HazardLevel, string> = {
  none: "#64748b",
  watch: "#f59e0b",
  elevated: "#f97316",
  high: "#dc2626",
  extreme: "#7c2d12",
};

export const HAZARD_LEVEL_LABEL: Record<HazardLevel, string> = {
  none: "keine",
  watch: "beobachten",
  elevated: "erhöht",
  high: "hoch",
  extreme: "extrem",
};

export const HAZARD_LEVEL_TONE: Record<HazardLevel, string> = {
  none: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  watch: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  elevated: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  high: "bg-red-500/15 text-red-700 dark:text-red-300",
  extreme: "bg-red-900/20 text-red-800 dark:text-red-200",
};

export const HAZARD_KIND_LABEL: Record<HazardKind, string> = {
  hail: "Hagel",
  flood: "Sturzflut",
};