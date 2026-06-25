import type { AlertSeverity } from "@/lib/weather/types";
import { severityToLevel, WARN_LEVEL } from "@/lib/weather/thresholds/warn-level";
import { cn } from "@/lib/utils";

const STYLES: Record<AlertSeverity, string> = {
  minor: "bg-warn-minor text-warn-minor-fg",
  moderate: "bg-warn-moderate text-warn-moderate-fg",
  severe: "bg-warn-severe text-warn-severe-fg",
  extreme: "bg-warn-extreme text-warn-extreme-fg",
};

export function WarnBadge({
  severity, label, showLevel = false, className,
}: { severity: AlertSeverity; label?: string; showLevel?: boolean; className?: string }) {
  const lvl = severityToLevel(severity);
  const info = WARN_LEVEL[lvl];
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
      STYLES[severity], className,
    )}>
      {label ?? (showLevel ? `Stufe ${lvl} · ${info.name}` : info.name)}
    </span>
  );
}
