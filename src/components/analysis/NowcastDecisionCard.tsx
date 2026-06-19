import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { buildNowcast2h } from "@/lib/weather/analysis/nowcast";
import type { HourlyPoint, MinutelyPoint } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

/**
 * Kompakte Entscheidungsansicht für die Analyse-Seite:
 * 2h Nowcast als Liste, ergänzt um harte fachliche Kennzahlen.
 */
export function NowcastDecisionCard({
  hourly,
  minutely,
  now,
}: {
  hourly: HourlyPoint[];
  minutely?: MinutelyPoint[];
  now: Date;
}) {
  const nc = buildNowcast2h(hourly, minutely, now);

  return (
    <DataCard
      title="Kurzfrist-Entscheidung 0–2 Stunden"
      subtitle="10-Minuten-Auflösung, kombiniert aus Radar-Niederschlag und Konvektionsparametern."
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="font-mono text-5xl font-semibold leading-none" style={{ fontFamily: "var(--font-mono)" }}>{nc.peakScore}</div>
        {nc.peakLevel !== "none" && <WarnBadge severity={nc.peakLevel} />}
        {nc.hailMax !== "none" && <WarnBadge severity={nc.hailMax} label="Hagel" />}
        <div className="ml-auto text-right text-xs text-muted-foreground">
          <div className="text-sm font-semibold text-foreground">{nc.headline}</div>
          <div>Vertrauen {nc.confidence}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-1 lg:grid-cols-12">
        {nc.steps.map((s) => (
          <div
            key={s.time}
            className={cn("flex min-w-0 flex-col items-center gap-1 rounded-md border bg-background/40 px-1 py-1.5",
              levelBorder(s.level),
            )}
          >
            <span className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {s.minutesFromNow === 0 ? "jetzt" : `+${s.minutesFromNow}m`}
            </span>
            <div className={cn("h-2 w-full rounded-sm", levelBg(s.level))} />
            <span className="font-mono text-[10px] font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{s.severeScore}</span>
            <span className="font-mono text-[9px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {s.precipMmPerH >= 0.2 ? `${s.precipMmPerH.toFixed(1)}mm` : "·"}
            </span>
            {s.thunderProb >= 0.3 && (
              <span className="text-[9px] uppercase text-warn-moderate">⚡{Math.round(s.thunderProb * 100)}</span>
            )}
          </div>
        ))}
      </div>
    </DataCard>
  );
}

function levelBg(level: string) {
  return level === "extreme" ? "bg-warn-extreme"
    : level === "severe" ? "bg-warn-severe"
    : level === "moderate" ? "bg-warn-moderate"
    : level === "minor" ? "bg-warn-minor"
    : "bg-muted";
}
function levelBorder(level: string) {
  return level === "extreme" ? "border-warn-extreme"
    : level === "severe" ? "border-warn-severe"
    : level === "moderate" ? "border-warn-moderate"
    : level === "minor" ? "border-warn-minor"
    : "border-border";
}