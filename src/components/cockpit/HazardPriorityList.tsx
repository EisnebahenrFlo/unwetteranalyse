import { useState } from "react";
import { ChevronDown, Check } from "@/components/icons";
import { MeteoconIcon } from "@/components/weather/MeteoconIcon";
import { Card } from "@/components/ui/card";
import { WarnBadge } from "@/components/common/WarnBadge";
import { SeverityRail, hazardKindToLevel } from "@/components/common/SeverityRail";
import { formatHazardWindow, type Hazard, type HazardKind } from "@/lib/weather/analysis/hazards";
import type { WeatherAlert } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

const KIND_BAR: Record<HazardKind, string> = {
  minor: "bg-warn-minor",
  moderate: "bg-warn-moderate",
  severe: "bg-warn-severe",
  extreme: "bg-warn-extreme",
  heat: "bg-heat",
  cold: "bg-cold",
  info: "bg-info",
};

const KIND_DOT: Record<HazardKind, string> = {
  minor: "bg-warn-minor/15 text-warn-minor",
  moderate: "bg-warn-moderate/15 text-warn-moderate",
  severe: "bg-warn-severe/15 text-warn-severe",
  extreme: "bg-warn-extreme/15 text-warn-extreme",
  heat: "bg-heat/15 text-heat",
  cold: "bg-cold/15 text-cold",
  info: "bg-info/15 text-info",
};

const METEOCON_BY_CAT: Record<
  Hazard["category"],
  | "thunderstorms-day-rain"
  | "hail"
  | "windsock"
  | "rain"
  | "snow"
  | "sleet"
  | "fog-day"
  | "thermometer"
  | "clear-day"
  | "wind"
> = {
  thunderstorm: "thunderstorms-day-rain",
  hail: "hail",
  wind: "windsock",
  rain: "rain",
  snow: "snow",
  ice: "sleet",
  fog: "fog-day",
  heat: "thermometer",
  cold: "thermometer",
  uv: "clear-day",
  tornado: "wind",
};

/**
 * Priorisierte Gefahrenliste statt Kachelwüste.
 * Sortierung kommt aus `buildHazards`: echte Unwetter zuerst, Heat/Cold/Info danach.
 */
export function HazardPriorityList({
  hazards,
  officialAlerts,
}: {
  hazards: Hazard[];
  officialAlerts: WeatherAlert[];
}) {
  const items = hazards.slice(0, 6);

  if (items.length === 0 && officialAlerts.length === 0) {
    return (
      <Card className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-4 md:p-5">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-foreground">
          <Check className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            Keine markanten Gefahren in den nächsten 24 Stunden.
          </div>
          <div className="text-[11px] text-muted-foreground">
            Weder eigene Schwellen noch amtliche Warnungen aktiv.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col divide-y divide-border/60 p-0">
      {officialAlerts.length > 0 && (
        <div className="flex items-center gap-2 bg-warn-moderate/5 px-4 py-2 text-[12px] text-warn-moderate">
          <span className="rounded bg-warn-moderate/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            Amtlich
          </span>
          <span className="truncate">
            {officialAlerts.length} aktive Warnung{officialAlerts.length === 1 ? "" : "en"} vom DWD
            im Gebiet.
          </span>
        </div>
      )}
      {items.map((h) => (
        <HazardRow key={h.id} h={h} />
      ))}
    </Card>
  );
}

function HazardRow({ h }: { h: Hazard }) {
  const [open, setOpen] = useState(false);
  const level = hazardKindToLevel(h.kind);
  return (
    <div className="grid grid-cols-[10px_auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
      {level ? (
        <SeverityRail level={level} orientation="vertical" showLabel={false} className="h-10 gap-0" />
      ) : (
        <div className={cn("h-10 w-1 rounded-full", KIND_BAR[h.kind])} />
      )}
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md", KIND_DOT[h.kind])}>
        <MeteoconIcon name={METEOCON_BY_CAT[h.category]} className="h-7 w-7" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{h.title}</span>
          {h.kind === "heat" && (
            <span className="rounded bg-heat/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-heat">
              Hitze
            </span>
          )}
          {h.kind === "cold" && (
            <span className="rounded bg-cold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cold">
              Kälte
            </span>
          )}
          {h.kind === "info" && (
            <span className="rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">
              Hinweis
            </span>
          )}
        </div>
        <div className="truncate text-[12px] text-muted-foreground">
          {h.description} · {formatHazardWindow(h)}
        </div>
        {open && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground sm:grid-cols-4">
            <Meta label="Kategorie" value={h.category} />
            <Meta label="Schwere" value={h.severity} />
            <Meta label="Konfidenz" value={`${h.confidence}/5`} />
            <Meta label="Peak" value={h.peakValue ?? "—"} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden flex-col items-end gap-0.5 sm:flex">
          {h.peakValue && (
            <span className="font-mono text-[12px] font-semibold tabular-nums text-foreground">
              {h.peakValue}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">Konf. {h.confidence}/5</span>
        </div>
        {h.kind !== "heat" && h.kind !== "cold" && h.kind !== "info" && (
          <WarnBadge severity={h.severity} className="hidden md:inline-flex" />
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={open ? "Details schließen" : "Details öffnen"}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className="truncate text-foreground">{value}</div>
    </div>
  );
}
