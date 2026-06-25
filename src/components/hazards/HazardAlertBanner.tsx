import { AlertTriangle, CloudHail, CloudRain, Zap } from "@/components/icons";
import type { HazardAlert, HazardKind } from "@/lib/weather/hazards/types";
import { HAZARD_KIND_LABEL, HAZARD_LEVEL_TONE } from "./hazard-tokens";
import { cn } from "@/lib/utils";

const ICONS: Record<HazardKind, React.ElementType> = {
  hail: CloudHail,
  flood: CloudRain,
  lightning: Zap,
};

/**
 * Kompakter Banner über dem Cockpit. Zeigt die nächstliegenden Hazards
 * (max 3) mit ETA und Klartext-Headline.
 */
export function HazardAlertBanner({ alerts }: { alerts: HazardAlert[] }) {
  if (!alerts.length) return null;
  const top = alerts.slice(0, 3);
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold tracking-tight">Hazard-Alerts</span>
        <span className="font-mono text-[10px] text-muted-foreground">{alerts.length} aktiv</span>
      </div>
      <ul className="divide-y divide-border/40">
        {top.map((a) => {
          const Icon = ICONS[a.kind];
          return (
            <li
              key={a.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-xs"
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md",
                  HAZARD_LEVEL_TONE[a.level],
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {HAZARD_KIND_LABEL[a.kind]} · {a.favoriteName}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">{a.headline}</div>
              </div>
              <div className="text-right font-mono text-[11px] text-muted-foreground">
                <div>{a.etaMin === 0 ? "jetzt" : `+${a.etaMin} min`}</div>
                <div className="opacity-70">{a.distanceKm.toFixed(0)} km</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
