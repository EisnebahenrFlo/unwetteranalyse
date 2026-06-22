import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeteoconIcon, meteoconNameForCode } from "@/components/weather/MeteoconIcon";
import { forecastQuery } from "@/lib/weather/queries";
import { buildHazards } from "@/lib/weather/analysis/hazards";
import type { AlertSeverity, SavedLocation } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

type Tone = "green" | "yellow" | "orange" | "red" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  orange: "bg-orange-500",
  red: "bg-red-500",
  muted: "bg-muted-foreground/30",
};

const TONE_LABEL: Record<Tone, string> = {
  green: "ruhig",
  yellow: "aufmerksam",
  orange: "markant",
  red: "kritisch",
  muted: "—",
};

function severityToTone(s: AlertSeverity | "none"): Tone {
  switch (s) {
    case "extreme":
    case "severe": return "red";
    case "moderate": return "orange";
    case "minor": return "yellow";
    default: return "green";
  }
}

interface Props {
  location: SavedLocation;
  isActive: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPick: (l: SavedLocation) => void;
  onMove: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}

/**
 * Eine Favoriten-Reihe: Ort + Region, kleines Wettericon, aktuelle Temperatur und Warnampel.
 * Ampel kommt aus `buildHazards().worstSevere` und ist damit fachlich an die App-Analyse gekoppelt.
 */
export function FavoriteRow({ location, isActive, canMoveUp, canMoveDown, onPick, onMove, onRemove }: Props) {
  const fc = useQuery(forecastQuery(location));
  const temp = fc.data?.current?.temperatureC;
  const code = fc.data?.current?.weatherCode ?? fc.data?.hourly[0]?.weatherCode;
  const hazards = fc.data ? buildHazards(fc.data) : null;
  const tone: Tone = !fc.data ? "muted" : severityToTone(hazards?.worstSevere ?? "none");

  return (
    <div
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
        isActive ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent/60",
      )}
    >
      <button
        onClick={() => onPick(location)}
        className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-left min-w-0"
        title={`${location.name}${location.admin ? ", " + location.admin : ""}`}
      >
        <div className="relative">
          <MeteoconIcon
            name={meteoconNameForCode(code)}
            label={location.name}
            className="h-8 w-8"
          />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card",
              TONE_CLASS[tone],
            )}
            title={`Warnampel: ${TONE_LABEL[tone]}`}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
            {location.name}
            {isActive && <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {[location.admin, location.country].filter(Boolean).join(" · ")}
          </div>
        </div>
      </button>
      <div className="text-right font-mono text-sm tabular-nums">
        {fc.isLoading ? "…" : Number.isFinite(temp) ? `${Math.round(temp!)}°` : "—"}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          disabled={!canMoveUp}
          onClick={(e) => { e.stopPropagation(); onMove(location.id, -1); }}
          aria-label="Nach oben"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          disabled={!canMoveDown}
          onClick={(e) => { e.stopPropagation(); onMove(location.id, 1); }}
          aria-label="Nach unten"
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
        <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onRemove(location.id); }}
            aria-label="Entfernen"
          >
            <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function FavoriteEmpty() {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
      <MapPin className="h-4 w-4" />
      <span>Noch keine Favoriten. Über die Suche einen Ort mit dem Stern speichern.</span>
    </div>
  );
}