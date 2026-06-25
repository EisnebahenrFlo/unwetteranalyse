import { cn } from "@/lib/utils";

/**
 * Signature-Element „Stufenband": schmaler Balken mit den vier DWD-Warnfarben,
 * der die aktuelle Stufe markiert. An Radar-dBZ kalibriert (Stufe 1 markant,
 * 2 Unwetter, 3 schwer, 4 extrem). Dezenter Pulse nur ab Stufe 3, respektiert
 * `prefers-reduced-motion` (Animationen werden global gedämpft).
 */
export type SeverityLevel = 1 | 2 | 3 | 4;

const LEVEL_COLOR: Record<SeverityLevel, string> = {
  1: "bg-warn-minor",
  2: "bg-warn-moderate",
  3: "bg-warn-severe",
  4: "bg-warn-extreme",
};

const LEVEL_LABEL: Record<SeverityLevel, string> = {
  1: "Stufe 1 · markant",
  2: "Stufe 2 · unwetter",
  3: "Stufe 3 · schwer",
  4: "Stufe 4 · extrem",
};

interface Props {
  level: SeverityLevel | null;
  orientation?: "vertical" | "horizontal";
  label?: string;
  showLabel?: boolean;
  className?: string;
}

export function SeverityRail({
  level,
  orientation = "horizontal",
  label,
  showLabel = true,
  className,
}: Props) {
  const isV = orientation === "vertical";
  const segments: SeverityLevel[] = [1, 2, 3, 4];

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        isV && "flex-col items-stretch",
        className,
      )}
      role="img"
      aria-label={label ?? (level ? LEVEL_LABEL[level] : "Stufe ruhig")}
    >
      <div
        className={cn(
          "flex overflow-hidden rounded-full bg-border/40",
          isV ? "h-24 w-1.5 flex-col" : "h-1.5 w-full min-w-[80px] flex-row",
        )}
      >
        {segments.map((s) => {
          const active = level != null && s <= level;
          return (
            <div
              key={s}
              className={cn(
                "flex-1 transition-opacity",
                active ? LEVEL_COLOR[s] : "bg-transparent",
                active && level === s && level >= 3 && "animate-pulse",
              )}
            />
          );
        })}
      </div>
      {showLabel && (
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-wider tabular-nums",
            level == null ? "text-muted-foreground" : "text-foreground",
            isV && "text-center",
          )}
        >
          {label ?? (level ? `S${level}` : "S0")}
        </span>
      )}
    </div>
  );
}

/* ---------- Mapper aus bestehenden Domain-Typen ---------- */

import type { StormSeverity } from "@/lib/weather/storm/types";
import type { AlertSeverity } from "@/lib/weather/types";
import type { HazardKind } from "@/lib/weather/analysis/hazards";

export function stormSeverityToLevel(s: StormSeverity): SeverityLevel | null {
  switch (s) {
    case "watch":
      return 1;
    case "serious":
      return 2;
    case "severe":
      return 3;
    case "extreme":
      return 4;
    default:
      return null;
  }
}

export function alertSeverityToLevel(s: AlertSeverity): SeverityLevel {
  switch (s) {
    case "minor":
      return 1;
    case "moderate":
      return 2;
    case "severe":
      return 3;
    case "extreme":
      return 4;
  }
}

export function hazardKindToLevel(k: HazardKind): SeverityLevel | null {
  switch (k) {
    case "minor":
      return 1;
    case "moderate":
      return 2;
    case "severe":
      return 3;
    case "extreme":
      return 4;
    default:
      return null;
  }
}

/** Score 0..100 → Stufe (entspricht den scoreLabel-Schwellen). */
export function scoreToLevel(score: number): SeverityLevel | null {
  if (score >= 70) return 3;
  if (score >= 45) return 2;
  if (score >= 20) return 1;
  return null;
}