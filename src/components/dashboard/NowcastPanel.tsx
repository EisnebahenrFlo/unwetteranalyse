import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { MeteoconIcon } from "@/components/weather/MeteoconIcon";
import { useLiveNow } from "@/hooks/use-live-now";
import { summarizeNowcast } from "@/lib/weather/analysis/nowcast";
import { formatLiveHour } from "@/lib/weather/format";
import type { ForecastBundle } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

export function NowcastPanel({ bundle }: { bundle: ForecastBundle }) {
  const now = useLiveNow();
  const summary = summarizeNowcast(bundle.hourly, now);

  return (
    <DataCard title="Gewitter & Unwetter Nowcast" subtitle="Kurzfristige Einschätzung für die nächsten 0 bis 6 Stunden." meta={bundle.meta}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)]">
        <div className="flex min-w-0 items-center gap-4">
          <div className={cn("grid h-24 w-24 shrink-0 place-items-center rounded-lg", summary.level === "none" ? "bg-accent/70" : "bg-warn-minor/20")}>
            <MeteoconIcon name="thunderstorms-day-rain" label="Gewitter Nowcast" className="h-20 w-20" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-mono text-5xl font-semibold leading-none" style={{ fontFamily: "var(--font-mono)" }}>{summary.score}</div>
              {summary.level !== "none" && <WarnBadge severity={summary.level} />}
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">{summary.headline}</div>
            <div className="text-xs text-muted-foreground">
              Peak {summary.peakTime ? formatLiveHour(summary.peakTime, now) : "nicht erkennbar"} · Vertrauen {summary.confidence}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {summary.metrics.map((metric) => (
            <div key={metric.label} className={cn("min-w-0 rounded-md border px-2.5 py-2", metric.active ? "border-warn-minor/60 bg-warn-minor/10" : "border-border bg-background/60")}>
              <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{metric.label}</div>
              <div className="truncate font-mono text-base font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{metric.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {summary.triggers.length > 0 ? summary.triggers.map((trigger) => (
          <span key={trigger} className="rounded-md border border-border bg-background/60 px-2 py-1">{trigger}</span>
        )) : <span>Keine markanten Signale in den nächsten Stunden.</span>}
      </div>
    </DataCard>
  );
}