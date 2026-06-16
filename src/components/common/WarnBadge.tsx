import type { AlertSeverity } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

const LABEL: Record<AlertSeverity, string> = {
  minor: "Markant",
  moderate: "Unwetter",
  severe: "Schweres Unwetter",
  extreme: "Extremes Unwetter",
};

const STYLES: Record<AlertSeverity, string> = {
  minor: "bg-warn-minor text-warn-minor-fg",
  moderate: "bg-warn-moderate text-warn-moderate-fg",
  severe: "bg-warn-severe text-warn-severe-fg",
  extreme: "bg-warn-extreme text-warn-extreme-fg",
};

export function WarnBadge({ severity, label, className }: { severity: AlertSeverity; label?: string; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
      STYLES[severity], className,
    )}>
      {label ?? LABEL[severity]}
    </span>
  );
}
