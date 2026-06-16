import { DataCard } from "@/components/common/DataCard";
import { useSettings } from "@/hooks/use-settings";
import { formatDate, formatPrecip, formatTemp, weatherCodeLabel } from "@/lib/weather/format";
import type { ForecastBundle } from "@/lib/weather/types";

export function DailyStrip({ bundle }: { bundle: ForecastBundle }) {
  const [settings] = useSettings();
  const days = bundle.daily.slice(0, 7);
  const min = Math.min(...days.map((d) => d.tempMinC));
  const max = Math.max(...days.map((d) => d.tempMaxC));
  return (
    <DataCard title="7-Tage Trend" meta={bundle.meta}>
      <div className="flex flex-col">
        {days.map((d) => {
          const left = ((d.tempMinC - min) / (max - min || 1)) * 100;
          const width = ((d.tempMaxC - d.tempMinC) / (max - min || 1)) * 100;
          return (
            <div key={d.date} className="grid grid-cols-[80px_minmax(0,1fr)_70px] items-center gap-3 border-b border-border/50 py-2 last:border-0">
              <div className="text-sm">
                <div className="font-medium text-foreground">{formatDate(d.date)}</div>
                <div className="text-[10px] text-muted-foreground">{weatherCodeLabel(d.weatherCode)}</div>
              </div>
              <div className="relative h-2 min-w-0 rounded-full bg-muted">
                <div
                  className="absolute h-2 rounded-full bg-gradient-to-r from-primary/60 to-warn-moderate/70"
                  style={{ left: `${left}%`, width: `${Math.max(8, width)}%` }}
                />
              </div>
              <div className="text-right font-mono text-xs" style={{ fontFamily: "var(--font-mono)" }}>
                <span className="text-muted-foreground">{formatTemp(d.tempMinC, settings.tempUnit).split(" ")[0]}°</span>
                <span className="mx-1 text-muted-foreground/40">|</span>
                <span className="font-semibold text-foreground">{formatTemp(d.tempMaxC, settings.tempUnit).split(" ")[0]}°</span>
                <div className="mt-0.5 text-[10px] text-primary">{formatPrecip(d.precipitationSumMm)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </DataCard>
  );
}
