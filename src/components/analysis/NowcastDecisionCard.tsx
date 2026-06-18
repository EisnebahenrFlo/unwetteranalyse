import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { summarizeNowcast } from "@/lib/weather/analysis/nowcast";
import { formatLiveHour } from "@/lib/weather/format";
import type { HourlyPoint } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

export function NowcastDecisionCard({ hourly, now }: { hourly: HourlyPoint[]; now: Date }) {
  const summary = summarizeNowcast(hourly, now);

  return (
    <DataCard title="Nowcast Entscheidung" subtitle="Schnelle fachliche Kurzfristbewertung für 0 bis 6 Stunden.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-3">
          <div className="font-mono text-5xl font-semibold leading-none" style={{ fontFamily: "var(--font-mono)" }}>{summary.score}</div>
          {summary.level !== "none" && <WarnBadge severity={summary.level} />}
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-foreground">{summary.headline}</div>
          <div className="text-xs text-muted-foreground">
            Peak {summary.peakTime ? formatLiveHour(summary.peakTime, now) : "nicht erkennbar"} · Vertrauen {summary.confidence}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {summary.metrics.map((metric) => (
              <div key={metric.label} className={cn("rounded-md border px-2.5 py-2", metric.active ? "border-warn-minor/60 bg-warn-minor/10" : "border-border bg-background/60")}>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{metric.label}</div>
                <div className="font-mono text-sm font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DataCard>
  );
}