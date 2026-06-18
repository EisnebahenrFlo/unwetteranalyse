import { DataCard } from "@/components/common/DataCard";
import { severeTimeline } from "@/lib/weather/analysis/convection";
import type { HourlyPoint } from "@/lib/weather/types";
import { formatHour } from "@/lib/weather/format";
import { cn } from "@/lib/utils";
import { useLiveNow } from "@/hooks/use-live-now";
import { isCurrentHour, liveHourly } from "@/lib/weather/live";

const LEVEL_CLASS = {
  none: "bg-muted",
  minor: "bg-warn-minor",
  moderate: "bg-warn-moderate",
  severe: "bg-warn-severe",
  extreme: "bg-warn-extreme",
} as const;

/**
 * Stündliche Severity-Heatmap für die nächsten 24 h.
 * Eine Spalte pro Stunde, Farbe = kombiniertes Unwetterrisiko.
 */
export function SevereTimeline({ hourly }: { hourly: HourlyPoint[] }) {
  const now = useLiveNow();
  const data = severeTimeline(liveHourly(hourly, now), 24);
  return (
    <DataCard
      title="Unwetter-Timeline (24 h)"
      subtitle="Pro Stunde: kombinierter Score aus Gewitter, Hagel, Böen und Starkregen."
    >
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] gap-1 [grid-template-columns:repeat(24,minmax(0,1fr))]">
          {data.map((d) => (
            <div key={d.time} className={cn("flex min-h-36 flex-col justify-end gap-1 rounded-md border border-transparent px-1 py-1.5", isCurrentHour(d.time, now) && "border-primary bg-accent")}> 
              <div className="text-center font-mono text-[10px] font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{d.score.value}</div>
              <div
                className={cn(
                  "w-full rounded-sm transition-colors",
                  LEVEL_CLASS[d.score.level],
                )}
                style={{ height: `${Math.max(8, d.score.value)}px` }}
                title={`${formatHour(d.time)} · ${d.score.value} · ${d.score.reasons.join(", ") || "ruhig"}`}
              />
              <span className="font-mono text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                {new Date(d.time).getHours().toString().padStart(2, "0")}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{Math.round(d.thunderProb * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <Legend color="bg-muted" label="ruhig" />
        <Legend color="bg-warn-minor" label="markant" />
        <Legend color="bg-warn-moderate" label="Unwetter" />
        <Legend color="bg-warn-severe" label="schweres Unwetter" />
        <Legend color="bg-warn-extreme" label="extrem" />
      </div>
    </DataCard>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block h-2 w-3 rounded-sm", color)} />
      {label}
    </span>
  );
}