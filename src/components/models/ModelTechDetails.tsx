import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "@/components/icons";
import { WEATHER_MODELS } from "@/lib/weather/models";
import { cn } from "@/lib/utils";

export function ModelTechDetails() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold">Technische Modelldetails</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {WEATHER_MODELS.length} Modelle · Auflösung, Anbieter, Region
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ul className="divide-y divide-border/50 border-t border-border/60">
          {WEATHER_MODELS.map((m) => (
            <li
              key={m.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-5 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{m.label}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {m.provider} · {m.region}
                </div>
              </div>
              <div className="text-right">
                <div
                  className="font-mono text-xs tabular-nums"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {m.resolutionKm} km
                </div>
                <div
                  className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {m.horizonHours} h
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
