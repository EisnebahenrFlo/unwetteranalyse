import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StormAlert } from "@/lib/weather/storm/types";
import { SEVERITY_LABEL } from "./severity-tokens";

export function StormAlertBanner({ alerts }: { alerts: StormAlert[] }) {
  if (alerts.length === 0) return null;
  const top = alerts[0];
  const tone =
    top.level === "extreme" ? "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300"
      : top.level === "severe" ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300"
        : top.level === "serious" ? "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300"
          : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300";

  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-xs", tone)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          {alerts.length} {alerts.length === 1 ? "Favorit" : "Favoriten"} im Stormpfad
        </div>
        <div className="truncate opacity-90">
          {alerts.slice(0, 3).map((a) => `${a.favoriteName} +${a.etaMin}min (${SEVERITY_LABEL[a.level]})`).join(" · ")}
          {alerts.length > 3 && ` · +${alerts.length - 3} weitere`}
        </div>
      </div>
    </div>
  );
}