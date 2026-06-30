import { cn } from "@/lib/utils";
import { WARN_LEVEL } from "@/lib/weather/thresholds/warn-level";

/**
 * Signature-Element „Stufenband": schmaler Balken mit den vier DWD-Warnfarben,
 * der die aktuelle Stufe markiert (Stufe 1 Wetterwarnung/gelb,
 * 2 Markantes Wetter/orange, 3 Unwetterwarnung/rot, 4 Extremes Unwetter/violett).
 * Dezenter Pulse nur ab Stufe 3, respektiert `prefers-reduced-motion`
 * (Animationen werden global gedämpft).
 */
export type SeverityLevel = 1 | 2 | 3 | 4;

const LEVEL_COLOR: Record<SeverityLevel, string> = {
  1: "bg-warn-minor",
  2: "bg-warn-moderate",
  3: "bg-warn-severe",
  4: "bg-warn-extreme",
};

const LEVEL_LABEL: Record<SeverityLevel, string> = {
  1: `Stufe 1 · ${WARN_LEVEL[1].name}`,
  2: `Stufe 2 · ${WARN_LEVEL[2].name}`,
  3: `Stufe 3 · ${WARN_LEVEL[3].name}`,
  4: `Stufe 4 · ${WARN_LEVEL[4].name}`,
};

interface Props {
  level: SeverityLevel | null;
  orientation?: "vertical" | "horizontal";
  label?: string;
  showLabel?: boolean;
  className?: string;
  /**
   * `segments` (Default): vier diskrete DWD-Segmente, klassisches Inline-Badge.
   * `gradient`: schmaler durchgehender Verlauf (Stufe 4 oben → Stufe 1 unten)
   * mit Pegel-Indikator, gedacht für die persistente App-Rail an der linken Kante.
   */
  variant?: "segments" | "gradient";
}

export function SeverityRail({
  level,
  orientation = "horizontal",
  label,
  showLabel = true,
  className,
  variant = "segments",
}: Props) {
  if (variant === "gradient") {
    return <SeverityRailGradient level={level} label={label} className={className} />;
  }
  const isV = orientation === "vertical";
  const segments: SeverityLevel[] = [1, 2, 3, 4];

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        isV && "flex-col items-stretch h-24",
        className,
      )}
      role="img"
      aria-label={label ?? (level ? LEVEL_LABEL[level] : "Stufe ruhig")}
    >
      <div
        className={cn(
          "flex overflow-hidden rounded-full bg-border/40",
          isV ? "h-full w-1.5 flex-col" : "h-1.5 w-full min-w-[80px] flex-row",
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

/**
 * Persistente Signatur-Rail (vertikal, full-height).
 * Reihenfolge oben→unten: Stufe 4 violett, 3 rot, 2 orange, 1 gelb.
 * Ein heller Strich markiert die aktuell höchste aktive Warnstufe.
 */
function SeverityRailGradient({
  level,
  label,
  className,
}: {
  level: SeverityLevel | null;
  label?: string;
  className?: string;
}) {
  // Indikator-Position: Stufe 4 oben = 12.5%, 3 = 37.5%, 2 = 62.5%, 1 = 87.5%.
  const indicatorTop = level == null ? null : `${(4 - level) * 25 + 12.5}%`;
  return (
    <div
      role="img"
      aria-label={label ?? (level ? LEVEL_LABEL[level] : "Keine aktive Warnung")}
      className={cn("relative h-full w-1.5", className)}
    >
      <div
        className="absolute inset-0 rounded-full opacity-80"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--warn-extreme) 0%, var(--warn-extreme) 25%, var(--warn-severe) 25%, var(--warn-severe) 50%, var(--warn-moderate) 50%, var(--warn-moderate) 75%, var(--warn-minor) 75%, var(--warn-minor) 100%)",
        }}
      />
      {indicatorTop != null && (
        <div
          className="absolute -left-1 -right-1 h-[2px] rounded-full bg-foreground shadow-[0_0_6px_var(--ring)]"
          style={{ top: indicatorTop }}
          aria-hidden
        />
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