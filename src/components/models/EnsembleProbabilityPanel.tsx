import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GeoPoint } from "@/lib/weather/types";
import { ensembleQuery } from "@/lib/weather/queries";
import { useLiveNow } from "@/hooks/use-live-now";
import { analyzeEnsemble } from "@/lib/weather/analysis/ensemble";
import { DataCard } from "@/components/common/DataCard";
import { InfoPopover } from "@/components/common/InfoPopover";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  point: GeoPoint;
}

const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit" });

const fmtDateTime = (v: string) =>
  new Date(v).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
  });

export function EnsembleProbabilityPanel({ point }: Props) {
  const q = useQuery(ensembleQuery(point));
  const now = useLiveNow();

  const { timeline, summary } = useMemo(
    () =>
      q.data
        ? analyzeEnsemble(q.data, now)
        : { timeline: [], summary: null as ReturnType<typeof analyzeEnsemble>["summary"] | null },
    [q.data, now],
  );

  const probData = useMemo(
    () =>
      timeline.map((p) => ({
        time: p.time,
        gewitter: Math.round(p.pThunder * 100),
        starkregen: Math.round(p.pHeavyRain * 100),
        sturm: Math.round(p.pStorm * 100),
      })),
    [timeline],
  );

  const capeData = useMemo(
    () =>
      timeline
        .filter((p) => p.capeMedian != null)
        .map((p) => ({
          time: p.time,
          median: p.capeMedian,
          band: p.capeBand,
        })),
    [timeline],
  );

  const info = (
    <InfoPopover title="Ensemble-Wahrscheinlichkeiten">
      Jeder Member ist ein leicht gestörter Modelllauf. Der Anteil der Member über einer
      DWD-Schwelle ist die Wahrscheinlichkeit. Ein Ensemble bildet Unsicherheit ehrlicher ab als
      der Spread aus deterministischen Läufen.
    </InfoPopover>
  );

  return (
    <DataCard
      title="Ensemble-Wahrscheinlichkeiten"
      subtitle="ICON-EU-EPS · 40 Member · echte probabilistische Streuung."
      action={info}
      meta={{
        source: "open-meteo",
        updatedAt: new Date(q.dataUpdatedAt || Date.now()).toISOString(),
        uncertainty: "Ensemble icon_eu_eps, 40 Member",
      }}
    >
      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : timeline.length === 0 ? (
        <p className="text-xs text-muted-foreground">Keine Ensemble-Daten verfügbar.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {summary && (
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {summary.headline}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Wahrscheinlichkeit pro Stunde · % der Member
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={probData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border"
                    opacity={0.4}
                  />
                  <XAxis
                    dataKey="time"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 10 }}
                    minTickGap={32}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10 }}
                    width={32}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip
                    labelFormatter={(v) => fmtDateTime(v as string)}
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                    }}
                    formatter={(value, name) => [`${value}%`, name as string]}
                  />
                  <Line
                    type="monotone"
                    dataKey="gewitter"
                    name="Gewitterpotenzial"
                    stroke="var(--chart-1)"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="starkregen"
                    name="Starkregen"
                    stroke="var(--chart-2)"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sturm"
                    name="Sturm"
                    stroke="var(--chart-3)"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <LegendDot color="var(--chart-1)" label="Gewitterpotenzial (CAPE ≥ 500)" />
              <LegendDot color="var(--chart-2)" label="Starkregen (≥ 15 mm/h)" />
              <LegendDot color="var(--chart-3)" label="Sturm (Böen ≥ 25 m/s)" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              CAPE-Fächer · p10–p90 und Median (J/kg)
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={capeData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border"
                    opacity={0.4}
                  />
                  <XAxis
                    dataKey="time"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 10 }}
                    minTickGap={32}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    width={40}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    labelFormatter={(v) => fmtDateTime(v as string)}
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                    }}
                    formatter={(value, name) => {
                      if (name === "band") {
                        const v = value as unknown as [number, number] | null;
                        if (!v) return [null as unknown as string, ""];
                        return [
                          `${Math.round(v[0])} – ${Math.round(v[0] + v[1])}`,
                          "p10–p90",
                        ];
                      }
                      if (name === "median")
                        return [`${Math.round(value as number)} J/kg`, "Median"];
                      return [value as number, name as string];
                    }}
                  />
                  <ReferenceLine
                    y={500}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    strokeDasharray="3 3"
                    label={{
                      value: "mäßig",
                      fontSize: 10,
                      fill: "currentColor",
                      position: "right",
                    }}
                  />
                  <ReferenceLine
                    y={1500}
                    stroke="currentColor"
                    className="text-destructive"
                    strokeDasharray="3 3"
                    label={{
                      value: "hoch",
                      fontSize: 10,
                      fill: "currentColor",
                      position: "right",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="band"
                    stroke="none"
                    fill="currentColor"
                    className="text-muted-foreground"
                    fillOpacity={0.15}
                    isAnimationActive={false}
                    activeDot={false}
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="median"
                    stroke="currentColor"
                    className="text-foreground"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </DataCard>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}