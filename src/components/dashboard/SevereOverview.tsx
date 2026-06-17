import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { MeteoconIcon } from "@/components/weather/MeteoconIcon";
import { useLiveNow } from "@/hooks/use-live-now";
import { severeScore, severeTimeline, summarizeModelSevere } from "@/lib/weather/analysis/convection";
import { liveHourly } from "@/lib/weather/live";
import { formatLiveHour } from "@/lib/weather/format";
import type { ForecastBundle } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

const LEVEL_TEXT = {
  none: "ruhig",
  minor: "markant möglich",
  moderate: "Unwetter-Signal",
  severe: "deutliches Unwetter-Signal",
  extreme: "extremes Signal",
} as const;

export function SevereOverview({ bundle }: { bundle: ForecastBundle }) {
  const now = useLiveNow();
  const hourly = liveHourly(bundle.hourly, now);
  const summary = summarizeModelSevere(hourly, 24);
  const timeline = severeTimeline(hourly, 24);
  const firstPoint = hourly[0] ?? bundle.hourly[0];
  const fallbackPeak = firstPoint
    ? { time: firstPoint.time, score: severeScore(firstPoint), thunderProb: 0, hail: "none" as const, downburst: "none" as const }
    : { time: now.toISOString(), score: { value: 0, level: "none" as const, reasons: [] }, thunderProb: 0, hail: "none" as const, downburst: "none" as const };
  const peak = timeline.reduce((best, item) => item.score.value > best.score.value ? item : best, timeline[0] ?? fallbackPeak);
  const reasons = peak.score.reasons.slice(0, 3);

  return (
    <DataCard title="Unwetter-Einschätzung jetzt" subtitle="Schnelle Lagebewertung der nächsten 24 Stunden." meta={bundle.meta}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-accent/60">
            <MeteoconIcon name="thunderstorms-day-rain" label="Gewitter" className="h-16 w-16" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-mono text-5xl font-semibold leading-none tracking-tight" style={{ fontFamily: "var(--font-mono)" }}>
                {summary.worstScore}
              </div>
              {summary.level !== "none" && <WarnBadge severity={summary.level} />}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">{LEVEL_TEXT[summary.level]}</div>
            <div className="text-xs text-muted-foreground">Peak {formatLiveHour(peak.time, now)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="Gewitter" value={`${Math.round(summary.thunderProbMax * 100)} %`} active={summary.thunderProbMax >= 0.25} />
          <Metric label="CAPE" value={summary.capeMax != null ? `${summary.capeMax.toFixed(0)} J/kg` : "—"} active={(summary.capeMax ?? 0) >= 500} />
          <Metric label="Starkregen" value={`${summary.precipMaxMm.toFixed(1)} mm/h`} active={summary.precipMaxMm >= 15} />
          <Metric label="Böen" value={`${(summary.gustMaxMs * 3.6).toFixed(0)} km/h`} active={summary.gustMaxMs >= 14} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {reasons.length > 0 ? reasons.map((reason) => (
          <span key={reason} className="rounded-md border border-border bg-background/60 px-2 py-1">{reason}</span>
        )) : <span>Keine markanten Gewitter- oder Unwetterparameter im 24-h-Fenster.</span>}
      </div>
    </DataCard>
  );
}

function Metric({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-md border px-2.5 py-2", active ? "border-warn-minor/50 bg-warn-minor/10" : "border-border bg-background/60")}>
      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-sm font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{value}</div>
    </div>
  );
}