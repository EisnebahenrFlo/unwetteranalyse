import { Zap } from "@/components/icons";
import { MeteoconIcon, isNightAt } from "@/components/weather/MeteoconIcon";
import type { DailyPoint } from "@/lib/weather/types";
import type { NowcastStep } from "@/lib/weather/scoring/nowcast";
import { bandColorClass } from "@/lib/weather/scoring/labels";
import { formatHour } from "@/lib/weather/format";
import { cn } from "@/lib/utils";

export function NowcastTable({ steps, daily }: { steps: NowcastStep[]; daily?: DailyPoint[] }) {
  const maxRain = Math.max(1, ...steps.map((s) => s.point.precipitationMm ?? 0));
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[58px_36px_44px_minmax(0,1fr)_64px_44px_30px] items-center gap-2 border-b border-border bg-muted/50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <div>Zeit</div>
        <div>Wetter</div>
        <div>Gewitter</div>
        <div>Regen / Wind</div>
        <div className="text-right">km/h Bö</div>
        <div className="text-right">Score</div>
        <div className="text-right">Cf</div>
      </div>
      <div className="divide-y divide-border/60">
        {steps.map((s) => (
          <Row key={s.time} step={s} maxRain={maxRain} daily={daily} />
        ))}
      </div>
    </div>
  );
}

function Row({
  step,
  maxRain,
  daily,
}: {
  step: NowcastStep;
  maxRain: number;
  daily?: DailyPoint[];
}) {
  const night = isNightAt(step.time, daily);
  const c = bandColorClass(step.band);
  const mm = step.point.precipitationMm ?? 0;
  const rainPct = Math.max(0, Math.min(100, (mm / maxRain) * 100));
  const gKmh = step.point.windGustMs != null ? step.point.windGustMs * 3.6 : null;
  const thunderPct = step.thunder.value;
  const conf = Math.round(
    (step.rain.confidence +
      step.wind.confidence +
      step.thunder.confidence +
      step.convection.confidence) /
      4,
  );
  const confDot = conf >= 75 ? "bg-emerald-500" : conf >= 45 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div
      className={cn(
        "grid grid-cols-[58px_36px_44px_minmax(0,1fr)_64px_44px_30px] items-center gap-2 px-2 py-1.5",
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
        <MeteoconIcon code={step.weatherCode} isNight={night} className="h-7 w-7" label="Wetter" />
      </div>
      <div className="flex items-center gap-1 text-[10.5px]">
        {thunderPct >= 30 ? (
          <span className="rounded bg-warn-moderate/15 px-1.5 py-0.5 font-semibold text-warn-moderate">
            <Zap className="h-3 w-3 inline-block" /> {thunderPct}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px]">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              style={{ width: `${rainPct}%` }}
            />
          </div>
          <span className="font-mono text-[10.5px] tabular-nums text-foreground">
            {mm >= 0.05 ? `${mm.toFixed(1)} mm/h` : "—"}
          </span>
        </div>
      </div>
      <div className="text-right font-mono text-[11px] tabular-nums text-foreground">
        {gKmh != null ? gKmh.toFixed(0) : "—"}
      </div>
      <div className="text-right">
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
            c.bg,
            c.text,
          )}
        >
          {step.total}
        </span>
      </div>
      <div className="flex items-center justify-end">
        <span
          className={cn("inline-block h-2 w-2 rounded-full", confDot)}
          title={`Vertrauen ${conf}/100`}
        />
      </div>
    </div>
  );
}