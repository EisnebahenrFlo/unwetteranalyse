import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { InfoPopover } from "@/components/common/InfoPopover";
import { summarizeModelSevere } from "@/lib/weather/analysis/convection";
import type { ModelSeries } from "@/lib/weather/types";
import { cn } from "@/lib/utils";
import { useLiveNow } from "@/hooks/use-live-now";
import { liveHourly } from "@/lib/weather/live";
import { getModelInfo } from "@/lib/weather/models";

/**
 * Zeigt für jedes Modell die wichtigsten Unwetter-Kennzahlen der nächsten 24 h.
 * Ziel: Schneller Überblick, welche Modelle ein Gewitter- oder Unwetter-Signal liefern.
 */
export function ModelSeverityGrid({ series }: { series: ModelSeries[] }) {
  const now = useLiveNow();
  return (
    <DataCard
      title="Gewitter & Unwetter pro Modell (24 h)"
      subtitle="Modell-Spread für CAPE, LI, Böen und Starkregen."
      action={
        <InfoPopover title="Modell-Spread Unwetter">
          Wenn mehrere Modelle hohe CAPE und stark negative LI zeigen, ist die Lage robust. Streuen
          die Modelle weit, ist die Prognose unsicher.
        </InfoPopover>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-1.5 pr-3">Modell</th>
              <th className="py-1.5 pr-3">Score</th>
              <th className="py-1.5 pr-3">CAPE max</th>
              <th className="py-1.5 pr-3">LI min</th>
              <th className="py-1.5 pr-3">Böen max</th>
              <th className="py-1.5 pr-3">Schwüle</th>
              <th className="py-1.5 pr-3">0 °C min</th>
              <th className="py-1.5 pr-3">Regen max</th>
              <th className="py-1.5 pr-3">Gewitter</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => {
              const info = getModelInfo(s.model);
              // AIFS hat keine Konvektions-Parameter — gar nicht erst zeigen.
              if (!info?.hazards.cape) return null;
              const live = liveHourly(s.hourly, now);
              const sum = summarizeModelSevere(live);
              const dewMax = Math.max(0, ...live.slice(0, 24).map((p) => p.dewPointC ?? 0));
              const freezingMin = Math.min(
                ...live.slice(0, 24).map((p) => p.freezingLevelM ?? Number.POSITIVE_INFINITY),
              );
              return (
                <tr key={s.model} className="border-t border-border/50">
                  <td className="py-2 pr-3 font-medium">{s.label}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <ScoreBar value={sum.worstScore} />
                      {sum.level !== "none" && <WarnBadge severity={sum.level} />}
                    </div>
                  </td>
                  <td className="py-2 pr-3 font-mono" style={{ fontFamily: "var(--font-mono)" }}>
                    {sum.capeMax != null ? `${sum.capeMax.toFixed(0)} J/kg` : "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono" style={{ fontFamily: "var(--font-mono)" }}>
                    {info.hazards.liftedIndex && sum.liMin != null ? sum.liMin.toFixed(1) : "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono" style={{ fontFamily: "var(--font-mono)" }}>
                    {info.hazards.gusts ? `${(sum.gustMaxMs * 3.6).toFixed(0)} km/h` : "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono" style={{ fontFamily: "var(--font-mono)" }}>
                    {dewMax > 0 ? `${dewMax.toFixed(1)} °C` : "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono" style={{ fontFamily: "var(--font-mono)" }}>
                    {Number.isFinite(freezingMin) ? `${Math.round(freezingMin)} m` : "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono" style={{ fontFamily: "var(--font-mono)" }}>
                    {sum.precipMaxMm.toFixed(1)} mm
                  </td>
                  <td className="py-2 pr-3 font-mono" style={{ fontFamily: "var(--font-mono)" }}>
                    {Math.round(sum.thunderProbMax * 100)} %
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}

function ScoreBar({ value }: { value: number }) {
  const color =
    value >= 70
      ? "bg-warn-severe"
      : value >= 45
        ? "bg-warn-moderate"
        : value >= 20
          ? "bg-warn-minor"
          : "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.max(4, value)}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
        {value}
      </span>
    </div>
  );
}
