import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { buildNowcast2h, type NowcastStep } from "@/lib/weather/analysis/nowcast";
import type { AlertSeverity, DailyPoint, HourlyPoint, MinutelyPoint } from "@/lib/weather/types";
import { cn } from "@/lib/utils";
import { MeteoconIcon, isNightAt } from "@/components/weather/MeteoconIcon";
import { formatHour } from "@/lib/weather/format";

/**
 * Kompakte Entscheidungsansicht für die Analyse-Seite:
 * 2h Nowcast als Liste, ergänzt um harte fachliche Kennzahlen.
 */
export function NowcastDecisionCard({
  hourly,
  minutely,
  now,
  daily,
}: {
  hourly: HourlyPoint[];
  minutely?: MinutelyPoint[];
  now: Date;
  daily?: DailyPoint[];
}) {
  const nc = buildNowcast2h(hourly, minutely, now);
  const maxPrecip = Math.max(1, ...nc.steps.map((s) => s.precipMmPerH));

  return (
    <DataCard
      title="Kurzfrist-Entscheidung 0–2 Stunden"
      subtitle="10-Minuten-Auflösung mit Wetter, Regen, Wind und Gewittersignal."
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-gradient-to-br from-card to-muted/30 px-3 py-2.5">
        <div className="font-mono text-3xl font-semibold leading-none tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
          {nc.peakScore}<span className="ml-1 text-xs font-normal text-muted-foreground">/100</span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{nc.headline}</div>
          <div className="text-[11px] text-muted-foreground">Vertrauen {nc.confidence} · Peak nach +{nc.peakStep?.minutesFromNow ?? 0} min</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {nc.peakLevel !== "none" && <WarnBadge severity={nc.peakLevel} />}
          {nc.hailMax !== "none" && <WarnBadge severity={nc.hailMax} label="Hagel" className="text-[10px]" />}
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[58px_40px_minmax(0,1fr)_64px_64px_50px] items-center gap-2 border-b border-border bg-muted/40 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div>Zeit</div>
          <div>Wetter</div>
          <div>Severity & Signal</div>
          <div className="text-right">Regen</div>
          <div className="text-right">Wind</div>
          <div className="text-right">Score</div>
        </div>
        <div className="divide-y divide-border/60">
          {nc.steps.map((s) => <Row key={s.time} step={s} maxPrecip={maxPrecip} daily={daily} />)}
        </div>
      </div>
    </DataCard>
  );
}

function Row({ step, maxPrecip, daily }: { step: NowcastStep; maxPrecip: number; daily?: DailyPoint[] }) {
  const night = isNightAt(step.time, daily);
  const sevPct = Math.max(2, Math.min(100, step.severeScore));
  const precipPct = Math.max(0, Math.min(100, (step.precipMmPerH / maxPrecip) * 100));
  const gustK = step.windGustMs != null ? step.windGustMs * 3.6 : null;
  const windK = step.windSpeedMs != null ? step.windSpeedMs * 3.6 : null;
  const sevBg = step.level === "extreme" ? "bg-warn-extreme"
    : step.level === "severe" ? "bg-warn-severe"
    : step.level === "moderate" ? "bg-warn-moderate"
    : step.level === "minor" ? "bg-warn-minor"
    : step.precipMmPerH >= 0.5 ? "bg-primary/60" : "bg-muted";
  const rainBg = step.precipMmPerH >= 25 ? "bg-warn-severe"
    : step.precipMmPerH >= 10 ? "bg-warn-moderate"
    : step.precipMmPerH >= 2.5 ? "bg-primary"
    : step.precipMmPerH >= 0.2 ? "bg-primary/50" : "bg-muted";
  return (
    <div className={cn(
      "grid grid-cols-[58px_40px_minmax(0,1fr)_64px_64px_50px] items-center gap-2 px-2 py-1.5",
      step.minutesFromNow === 0 && "bg-accent/40",
    )}>
      <div className="font-mono text-[11px] leading-tight tabular-nums">
        <div className="font-semibold text-foreground">{step.minutesFromNow === 0 ? "jetzt" : `+${step.minutesFromNow}m`}</div>
        <div className="text-[10px] text-muted-foreground">{formatHour(step.time)}</div>
      </div>
      <div className="flex items-center justify-center">
        <MeteoconIcon code={step.weatherCode} isNight={night} className="h-8 w-8" label="Wetter" />
      </div>
      <div className="min-w-0">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("absolute inset-y-0 left-0 rounded-full", sevBg)} style={{ width: `${sevPct}%` }} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
          {step.level !== "none" && (
            <span className="rounded bg-foreground/5 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-foreground">{lbl(step.level)}</span>
          )}
          {step.hail !== "none" && (
            <span className="rounded bg-warn-severe/15 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-warn-severe">Hagel</span>
          )}
          {step.thunderProb >= 0.3 && (
            <span className="rounded bg-warn-moderate/15 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-warn-moderate">⚡ {Math.round(step.thunderProb * 100)} %</span>
          )}
          {step.level === "none" && step.hail === "none" && step.thunderProb < 0.3 && (
            <span className="text-muted-foreground">ruhig</span>
          )}
        </div>
      </div>
      <div className="text-right font-mono text-[11px] tabular-nums">
        <div className="font-semibold text-foreground">{step.precipMmPerH >= 0.05 ? step.precipMmPerH.toFixed(1) : "—"}</div>
        <div className="relative ml-auto h-1 w-12 rounded-full bg-muted">
          <div className={cn("absolute inset-y-0 left-0 rounded-full", rainBg)} style={{ width: `${precipPct}%` }} />
        </div>
      </div>
      <div className="text-right font-mono text-[11px] tabular-nums">
        <div className="font-semibold text-foreground">{windK != null ? windK.toFixed(0) : "—"}</div>
        <div className="text-[10px] text-muted-foreground">{gustK != null ? `Bö ${gustK.toFixed(0)}` : ""}</div>
      </div>
      <div className="text-right font-mono text-[12px] font-semibold tabular-nums text-foreground">{step.severeScore}</div>
    </div>
  );
}

function lbl(s: AlertSeverity | "none"): string {
  return s === "extreme" ? "Extrem" : s === "severe" ? "Schwer" : s === "moderate" ? "Mäßig" : s === "minor" ? "Markant" : "—";
}