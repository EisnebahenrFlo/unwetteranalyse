import { DataCard } from "@/components/common/DataCard";
import type { ForecastBundle } from "@/lib/weather/types";
import { useSettings } from "@/hooks/use-settings";
import { formatHour, formatTemp, formatPrecip } from "@/lib/weather/format";
import { CloudRain } from "lucide-react";

export function HourlyStrip({ bundle }: { bundle: ForecastBundle }) {
  const [settings] = useSettings();
  const hours = bundle.hourly.slice(0, 24);
  const maxPrecip = Math.max(0.5, ...hours.map((h) => h.precipitationMm ?? 0));
  return (
    <DataCard title="Nächste 24 Stunden" meta={bundle.meta}>
      <div className="-mx-1 overflow-x-auto">
        <div className="flex min-w-full gap-1 px-1">
          {hours.map((h) => {
            const precip = h.precipitationMm ?? 0;
            const heightPct = Math.round((precip / maxPrecip) * 100);
            return (
              <div key={h.time} className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-center hover:bg-accent/50">
                <div className="text-[10px] text-muted-foreground">{formatHour(h.time)}</div>
                <div className="font-mono text-sm font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                  {formatTemp(h.temperatureC, settings.tempUnit).split(" ")[0]}°
                </div>
                <div className="flex h-10 w-full items-end justify-center">
                  <div
                    className="w-2 rounded-sm bg-primary/70 transition-all"
                    style={{ height: `${precip > 0 ? Math.max(4, heightPct) : 0}%` }}
                    title={`${formatPrecip(precip)} · ${(h.precipitationProbability ?? 0).toFixed(0)} %`}
                  />
                </div>
                <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <CloudRain className="h-2.5 w-2.5" />
                  {(h.precipitationProbability ?? 0).toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DataCard>
  );
}
