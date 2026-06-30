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
  none: "bg-muted text-muted-foreground",
  watch: "bg-warn-minor/15 text-warn-minor",
  elevated: "bg-warn-moderate/15 text-warn-moderate",
  high: "bg-warn-severe/15 text-warn-severe",
  extreme: "bg-warn-extreme/15 text-warn-extreme",
};

export const HAZARD_KIND_LABEL: Record<HazardKind, string> = {
  hail: "Hagel",
  flood: "Sturzflut",
};