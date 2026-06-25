import { DataCard } from "@/components/common/DataCard";
import { useSettings } from "@/hooks/use-settings";
import { formatDate, formatPrecip, formatTemp, weatherCodeLabel } from "@/lib/weather/format";
import type { ForecastBundle } from "@/lib/weather/types";
import { MeteoconIcon } from "@/components/weather/MeteoconIcon";
import { dailySeverity } from "@/lib/weather/analysis/nowcast";
import { WarnBadge } from "@/components/common/WarnBadge";

export function DailyStrip({ bundle }: { bundle: ForecastBundle }) {
  const [settings] = useSettings();
  const days = bundle.daily.slice(0, 7);
  const min = Math.min(...days.map((d) => d.tempMinC));
  const max = Math.max(...days.map((d) => d.tempMaxC));
  return (
    <DataCard
      title="7-Tage Trend"
      subtitle="Inklusive Gewitter- und Unwettersignal pro Tag."
      meta={bundle.meta}
    >
      <div className="flex flex-col">
        {days.map((d) => {
          const left = ((d.tempMinC - min) / (max - min || 1)) * 100;
          const width = ((d.tempMaxC - d.tempMinC) / (max - min || 1)) * 100;
          const severity = dailySeverity(bundle.hourly, d.date);
          return (
            <div
              key={d.date}
              className="grid grid-cols-[132px_auto_minmax(0,1fr)_70px] items-center gap-3 border-b border-border/50 py-2 last:border-0"
            >
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-sm">
                <MeteoconIcon
                  code={d.weatherCode}
                  className="h-10 w-10"
                  label={weatherCodeLabel(d.weatherCode)}
                />
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{formatDate(d.date)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {weatherCodeLabel(d.weatherCode)}
                  </div>
                </div>
              </div>
              <div className="min-w-[80px]">
                {severity.level !== "none" ? (
                  <WarnBadge severity={severity.level} label={severityPillLabel(severity.level)} />
                ) : (
                  <span className="inline-flex items-center rounded-md border border-border bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    ruhig
                  </span>
                )}
              </div>
              <div className="relative h-2 min-w-0 rounded-full bg-muted">
                <div
                  className="absolute h-2 rounded-full bg-gradient-to-r from-primary/60 to-warn-moderate/70"
                  style={{ left: `${left}%`, width: `${Math.max(8, width)}%` }}
                />
              </div>
              <div
                className="text-right font-mono text-xs"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span className="text-muted-foreground">
                  {formatTemp(d.tempMinC, settings.tempUnit).split(" ")[0]}°
                </span>
                <span className="mx-1 text-muted-foreground/40">|</span>
                <span className="font-semibold text-foreground">
                  {formatTemp(d.tempMaxC, settings.tempUnit).split(" ")[0]}°
                </span>
                <div className="mt-0.5 text-[10px] text-primary">
                  {formatPrecip(d.precipitationSumMm)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </DataCard>
  );
}

function severityPillLabel(level: "minor" | "moderate" | "severe" | "extreme"): string {
  if (level === "extreme") return "Extrem";
  if (level === "severe") return "Schwer";
  if (level === "moderate") return "Unwetter";
  return "Markant";
}
