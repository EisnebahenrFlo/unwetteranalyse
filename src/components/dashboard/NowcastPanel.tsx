import { Zap } from "@/components/icons";
import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { useLiveNow } from "@/hooks/use-live-now";
import { buildNowcast2h, type NowcastStep } from "@/lib/weather/analysis/nowcast";
import type { AlertSeverity, ForecastBundle } from "@/lib/weather/types";
import { cn } from "@/lib/utils";
import { MeteoconIcon, isNightAt } from "@/components/weather/MeteoconIcon";
import { formatHour } from "@/lib/weather/format";

const LEVEL_BG: Record<AlertSeverity | "none", string> = {
  none: "bg-muted",
  minor: "bg-warn-minor",
  moderate: "bg-warn-moderate",
  severe: "bg-warn-severe",
  extreme: "bg-warn-extreme",
};

/**
 * Premium 2 h Nowcast – lesbare Zeile-pro-Step-Darstellung mit Meteocon,
 * Wind, Regen, Temperatur, Gewitter-/Hagelmarker und Severity-Balken.
 */
export function NowcastPanel({ bundle }: { bundle: ForecastBundle }) {
  const now = useLiveNow();
  const nc = buildNowcast2h(bundle.hourly, bundle.minutely, now);
  const maxPrecip = Math.max(1, ...nc.steps.map((s) => s.precipMmPerH));

  return (
    <DataCard
      title="Unwetter-Nowcast · 2 Stunden"
      subtitle="10-Minuten-Auflösung mit Wetter, Regen, Wind und Gewittersignal."
      meta={bundle.meta}
    >
      {/* Headline */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-gradient-to-br from-card to-muted/30 px-3 py-2.5">
        <div
          className="font-mono text-3xl font-semibold leading-none tabular-nums"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {nc.peakScore}
          <span className="ml-1 text-xs font-normal text-muted-foreground">/100</span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{nc.headline}</div>
          <div className="text-[11px] text-muted-foreground">
            Vertrauen {nc.confidence} · Peak nach +{nc.peakStep?.minutesFromNow ?? 0} min
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {nc.peakLevel !== "none" && <WarnBadge severity={nc.peakLevel} />}
          {nc.hailMax !== "none" && (
            <WarnBadge
              severity={nc.hailMax}
              label={`Hagel ${labelSeverity(nc.hailMax)}`}
              className="text-[10px]"
            />
          )}
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Summary
          label="Gewitter Peak"
          value={`${Math.round(nc.thunderProbMax * 100)} %`}
          active={nc.thunderProbMax >= 0.3}
        />
        <Summary
          label="Regen Spitze"
          value={`${nc.precipMaxMmPerH.toFixed(1)} mm/h`}
          active={nc.precipMaxMmPerH >= 5}
        />
        <Summary
          label="Regen Σ 2 h"
          value={`${nc.precipSumMm.toFixed(1)} mm`}
          active={nc.precipSumMm >= 3}
        />
        <Summary
          label="Böen Spitze"
          value={`${windKmh(maxGust(nc.steps))} km/h`}
          active={maxGust(nc.steps) * 3.6 >= 50}
        />
      </div>

      {/* Step-Liste */}
      <div className="mt-3 overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[60px_44px_minmax(0,1fr)_70px_70px_60px] items-center gap-2 border-b border-border bg-muted/40 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div>Zeit</div>
          <div>Wetter</div>
          <div>Severity</div>
          <div className="text-right">Regen</div>
          <div className="text-right">Wind</div>
          <div className="text-right">Score</div>
        </div>
        <div className="divide-y divide-border/60">
          {nc.steps.map((s) => (
            <NowcastRow key={s.time} step={s} maxPrecip={maxPrecip} daily={bundle.daily} />
          ))}
        </div>
      </div>
    </DataCard>
  );
}

function NowcastRow({
  step,
  maxPrecip,
  daily,
}: {
  step: NowcastStep;
  maxPrecip: number;
  daily: ForecastBundle["daily"];
}) {
  const night = isNightAt(step.time, daily);
  const sevPct = Math.max(2, Math.min(100, step.severeScore));
  const precipPct = Math.max(0, Math.min(100, (step.precipMmPerH / maxPrecip) * 100));
  const gustK = step.windGustMs != null ? step.windGustMs * 3.6 : null;
  const windK = step.windSpeedMs != null ? step.windSpeedMs * 3.6 : null;
  return (
    <div
      className={cn(
        "grid grid-cols-[60px_44px_minmax(0,1fr)_70px_70px_60px] items-center gap-2 px-2 py-1.5",
        step.minutesFromNow === 0 && "bg-accent/40",
      )}
    >
      <div className="font-mono text-[11px] leading-tight tabular-nums">
        <div className="font-semibold text-foreground">
          {step.minutesFromNow === 0 ? "jetzt" : `+${step.minutesFromNow}m`}
        </div>
        <div className="text-[10px] text-muted-foreground">{formatHour(step.time)}</div>
      </div>
      <div className="flex items-center justify-center">
        <MeteoconIcon code={step.weatherCode} isNight={night} className="h-9 w-9" label="Wetter" />
      </div>
      <div className="min-w-0">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", LEVEL_BG[step.level])}
            style={{ width: `${sevPct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px]">
          {step.level !== "none" && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide",
                LEVEL_PILL[step.level],
              )}
            >
              {labelSeverity(step.level)}
            </span>
          )}
          {step.hail !== "none" && (
            <span className="rounded bg-warn-severe/15 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-warn-severe">
              Hagel
            </span>
          )}
          {step.thunderProb >= 0.3 && (
            <span className="rounded bg-warn-moderate/15 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-warn-moderate">
              <Zap className="h-3 w-3 inline-block" /> {Math.round(step.thunderProb * 100)} %
            </span>
          )}
          {step.level === "none" && step.hail === "none" && step.thunderProb < 0.3 && (
            <span className="text-muted-foreground">ruhig</span>
          )}
        </div>
      </div>
      <div className="text-right font-mono text-[11px] tabular-nums">
        <div className="font-semibold text-foreground">
          {step.precipMmPerH >= 0.05 ? step.precipMmPerH.toFixed(1) : "—"}
        </div>
        <div className="relative ml-auto h-1 w-12 rounded-full bg-muted">
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", rainColor(step.precipMmPerH))}
            style={{ width: `${precipPct}%` }}
          />
        </div>
      </div>
      <div className="text-right font-mono text-[11px] tabular-nums">
        <div className="font-semibold text-foreground">
          {windK != null ? windK.toFixed(0) : "—"}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {gustK != null ? `Bö ${gustK.toFixed(0)}` : ""}
        </div>
      </div>
      <div className="text-right font-mono text-[12px] font-semibold tabular-nums text-foreground">
        {step.severeScore}
      </div>
    </div>
  );
}

function Summary({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-2.5 py-1.5",
        active ? "border-warn-minor/60 bg-warn-minor/10" : "border-border bg-background/60",
      )}
    >
      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className="truncate font-mono text-base font-semibold tabular-nums"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </div>
    </div>
  );
}

function rainColor(mmPerH: number): string {
  if (mmPerH >= 25) return "bg-warn-severe";
  if (mmPerH >= 10) return "bg-warn-moderate";
  if (mmPerH >= 2.5) return "bg-primary";
  if (mmPerH >= 0.2) return "bg-primary/50";
  return "bg-muted";
}

function maxGust(steps: NowcastStep[]): number {
  return Math.max(0, ...steps.map((s) => s.windGustMs ?? 0));
}
function windKmh(ms: number): string {
  return (ms * 3.6).toFixed(0);
}
function labelSeverity(s: AlertSeverity | "none"): string {
  return s === "extreme"
    ? "Extrem"
    : s === "severe"
      ? "Schwer"
      : s === "moderate"
        ? "Mäßig"
        : s === "minor"
          ? "Markant"
          : "—";
}

const LEVEL_PILL: Record<AlertSeverity | "none", string> = {
  none: "bg-muted text-muted-foreground",
  minor: "bg-warn-minor/15 text-warn-minor",
  moderate: "bg-warn-moderate/15 text-warn-moderate",
  severe: "bg-warn-severe/15 text-warn-severe",
  extreme: "bg-warn-extreme/15 text-warn-extreme",
};
