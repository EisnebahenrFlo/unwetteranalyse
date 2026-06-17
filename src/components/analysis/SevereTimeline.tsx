import { DataCard } from "@/components/common/DataCard";
import { severeTimeline } from "@/lib/weather/analysis/convection";
import type { HourlyPoint } from "@/lib/weather/types";
import { formatHour } from "@/lib/weather/format";
import { cn } from "@/lib/utils";
import { useLiveNow } from "@/hooks/use-live-now";
import { isCurrentHour, liveHourly } from "@/lib/weather/live";

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
        <div className="flex min-w-[640px] items-end gap-1">
          {data.map((d) => (
            <div key={d.time} className={cn("flex flex-1 flex-col items-center gap-1 rounded-sm px-0.5", isCurrentHour(d.time, now) && "bg-accent")}> 
              <div
                className={cn(
                  "w-full rounded-sm transition-colors",
                  d.score.level === "severe" ? "bg-warn-severe" :
                  d.score.level === "moderate" ? "bg-warn-moderate" :
                  d.score.level === "minor" ? "bg-warn-minor" : "bg-muted",
                )}
                style={{ height: `${Math.max(6, d.score.value)}px` }}
                title={`${formatHour(d.time)} · ${d.score.value} · ${d.score.reasons.join(", ") || "ruhig"}`}
              />
              <span className="font-mono text-[9px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                {new Date(d.time).getHours().toString().padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <Legend color="bg-muted" label="ruhig" />
        <Legend color="bg-warn-minor" label="markant" />
        <Legend color="bg-warn-moderate" label="Unwetter" />
        <Legend color="bg-warn-severe" label="schweres Unwetter" />
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