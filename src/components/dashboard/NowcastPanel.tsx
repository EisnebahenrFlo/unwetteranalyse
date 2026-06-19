import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { useLiveNow } from "@/hooks/use-live-now";
import { buildNowcast2h, type NowcastStep } from "@/lib/weather/analysis/nowcast";
import type { AlertSeverity, ForecastBundle } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

const LEVEL_BG: Record<AlertSeverity | "none", string> = {
  none: "bg-muted",
  minor: "bg-warn-minor",
  moderate: "bg-warn-moderate",
  severe: "bg-warn-severe",
  extreme: "bg-warn-extreme",
};

const LEVEL_BORDER: Record<AlertSeverity | "none", string> = {
  none: "border-border",
  minor: "border-warn-minor",
  moderate: "border-warn-moderate",
  severe: "border-warn-severe",
  extreme: "border-warn-extreme",
};

export function NowcastPanel({ bundle }: { bundle: ForecastBundle }) {
  const now = useLiveNow();
  const nc = buildNowcast2h(bundle.hourly, bundle.minutely, now);

  return (
    <DataCard
      title="Unwetter-Nowcast 2 Stunden"
      subtitle="Gewitter, Starkregen und Hagel in 10-Minuten-Schritten."
      meta={bundle.meta}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-2">
          <div className="font-mono text-4xl font-semibold leading-none" style={{ fontFamily: "var(--font-mono)" }}>{nc.peakScore}</div>
          <div className="text-xs text-muted-foreground">Peak-Score</div>
        </div>
        {nc.peakLevel !== "none" && <WarnBadge severity={nc.peakLevel} />}
        {nc.hailMax !== "none" && <WarnBadge severity={nc.hailMax} label={`Hagel ${labelSeverity(nc.hailMax)}`} />}
        <div className="ml-auto text-right text-xs text-muted-foreground">
          <div className="font-medium text-foreground">{nc.headline}</div>
          <div>Vertrauen {nc.confidence}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-12 gap-1">
        {nc.steps.map((s) => (
          <NowcastCell key={s.time} step={s} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <Stat label="Gewitter peak" value={`${Math.round(nc.thunderProbMax * 100)} %`} active={nc.thunderProbMax >= 0.3} />
        <Stat label="Regen Spitze" value={`${nc.precipMaxMmPerH.toFixed(1)} mm/h`} active={nc.precipMaxMmPerH >= 5} />
        <Stat label="Regen Summe" value={`${nc.precipSumMm.toFixed(1)} mm`} active={nc.precipSumMm >= 5} />
        <Stat label="Hagel" value={nc.hailMax === "none" ? "—" : labelSeverity(nc.hailMax)} active={nc.hailMax !== "none"} />
      </div>
    </DataCard>
  );
}

function NowcastCell({ step }: { step: NowcastStep }) {
  const intensity = rainIntensity(step.precipMmPerH);
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 rounded-md border bg-background/40 px-1 py-1.5",
        LEVEL_BORDER[step.level],
      )}
      title={`+${step.minutesFromNow} min · Score ${step.severeScore} · Regen ${step.precipMmPerH.toFixed(1)} mm/h · Gewitter ${Math.round(step.thunderProb * 100)} %`}
    >
      <span className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
        {step.minutesFromNow === 0 ? "jetzt" : `+${step.minutesFromNow}m`}
      </span>
      <div className={cn("h-2 w-full rounded-sm", LEVEL_BG[step.level])} />
      <div className={cn("h-1.5 w-full rounded-sm", intensity.color)} title={`Regen ${intensity.label}`} />
      <span className="font-mono text-[10px] font-semibold leading-none" style={{ fontFamily: "var(--font-mono)" }}>{step.severeScore}</span>
      {step.hail !== "none" && <span className="text-[9px] uppercase text-warn-severe">Hagel</span>}
      {step.hail === "none" && step.thunderProb >= 0.3 && (
        <span className="text-[9px] uppercase text-warn-moderate">⚡ {Math.round(step.thunderProb * 100)}</span>
      )}
    </div>
  );
}

function rainIntensity(mmPerH: number): { color: string; label: string } {
  if (mmPerH >= 25) return { color: "bg-warn-severe", label: "extrem" };
  if (mmPerH >= 10) return { color: "bg-warn-moderate", label: "stark" };
  if (mmPerH >= 2.5) return { color: "bg-primary/70", label: "mäßig" };
  if (mmPerH >= 0.2) return { color: "bg-primary/30", label: "leicht" };
  return { color: "bg-muted", label: "trocken" };
}

function Stat({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-md border px-2.5 py-2", active ? "border-warn-minor/60 bg-warn-minor/10" : "border-border bg-background/60")}>
      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-base font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{value}</div>
    </div>
  );
}

function labelSeverity(s: AlertSeverity | "none"): string {
  return s === "extreme" ? "extrem" : s === "severe" ? "schwer" : s === "moderate" ? "mäßig" : s === "minor" ? "gering" : "—";
}