import { AlertTriangle } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { StormAlert } from "@/lib/weather/storm/types";
import { SEVERITY_LABEL } from "./severity-tokens";

export function StormAlertBanner({ alerts }: { alerts: StormAlert[] }) {
  if (alerts.length === 0) return null;
  const top = alerts[0];
  const tone =
    top.level === "extreme"
      ? "border-warn-extreme/50 bg-warn-extreme/10 text-warn-extreme"
      : top.level === "severe"
        ? "border-warn-severe/50 bg-warn-severe/10 text-warn-severe"
        : top.level === "serious"
          ? "border-warn-moderate/50 bg-warn-moderate/10 text-warn-moderate"
          : "border-warn-minor/50 bg-warn-minor/10 text-warn-minor";

  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-xs", tone)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          {alerts.length} {alerts.length === 1 ? "Favorit" : "Favoriten"} im Stormpfad
        </div>
        <div className="truncate opacity-90">
          {alerts
            .slice(0, 3)
            .map((a) => `${a.favoriteName} +${a.etaMin}min (${SEVERITY_LABEL[a.level]})`)
            .join(" · ")}
          {alerts.length > 3 && ` · +${alerts.length - 3} weitere`}
        </div>
      </div>
    </div>
  );
}
