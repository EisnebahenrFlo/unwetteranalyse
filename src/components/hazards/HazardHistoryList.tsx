import { useEffect, useState } from "react";
import { CloudHail, CloudRain, Zap, Inbox } from "lucide-react";
import { getFavoriteHistory } from "@/lib/weather/hazards/history";
import type { HazardHistoryEvent, HazardKind } from "@/lib/weather/hazards/types";
import { HAZARD_KIND_LABEL, HAZARD_LEVEL_LABEL, HAZARD_LEVEL_TONE } from "./hazard-tokens";
import { cn } from "@/lib/utils";

const ICONS: Record<HazardKind, React.ElementType> = {
  hail: CloudHail,
  flood: CloudRain,
  lightning: Zap,
};

/**
 * Hazard-Verlauf für einen Favoriten der letzten N Tage.
 * Aktualisiert sich live, wenn neue Events geschrieben werden.
 */
export function HazardHistoryList({
  favoriteId,
  days = 14,
  emptyHint,
}: {
  favoriteId: string;
  days?: number;
  emptyHint?: string;
}) {
  const [events, setEvents] = useState<HazardHistoryEvent[]>([]);

  useEffect(() => {
    const refresh = () => setEvents(getFavoriteHistory(favoriteId, days));
    refresh();
    window.addEventListener("meteoflo:hazard-history-changed", refresh);
    return () => window.removeEventListener("meteoflo:hazard-history-changed", refresh);
  }, [favoriteId, days]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-center text-xs text-muted-foreground">
        <Inbox className="h-5 w-5 opacity-50" />
        <span>{emptyHint ?? `Keine Hazard-Events in den letzten ${days} Tagen.`}</span>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/50">
      {events.map((e) => {
        const Icon = ICONS[e.kind];
        return (
          <li key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 py-2 text-xs">
            <span className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-md", HAZARD_LEVEL_TONE[e.level])}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">
                {HAZARD_KIND_LABEL[e.kind]} · {HAZARD_LEVEL_LABEL[e.level]} · Score {e.score}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">{e.headline}</div>
            </div>
            <div className="text-right font-mono text-[10px] text-muted-foreground">
              {new Date(e.occurredAt).toLocaleString("de-DE", {
                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}