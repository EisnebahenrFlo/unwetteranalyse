import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { ModelSeries } from "@/lib/weather/types";
import { useLiveNow } from "@/hooks/use-live-now";
import { buildCorridor, LONG_RANGE_MODEL_IDS } from "@/lib/weather/analysis/model-consensus";
import { DataCard } from "@/components/common/DataCard";
import { InfoPopover } from "@/components/common/InfoPopover";

interface Props {
  series: ModelSeries[];
}

const WEEKDAY = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { weekday: "long" });

export function ThunderstormTrendPanel({ series }: Props) {
  const now = useLiveNow();

  const subset = useMemo(
    () => series.filter((s) => LONG_RANGE_MODEL_IDS.includes(s.model)),
    [series],
  );

  const corridor = useMemo(
    () => (subset.length ? buildCorridor(subset, "cape", now, 336) : []),
    [subset, now],
  );

  const data = useMemo(
    () =>
      corridor
        .filter((c) => c.median != null)
        .map((c) => ({
          time: c.time,
          median: c.median,
          band: c.band,
        })),
    [corridor],
  );

  const headline = useMemo(() => {
    if (data.length === 0) return null;
    const firstHigh = data.find((d) => (d.median ?? 0) >= 1500);
    if (firstHigh) return `Deutliches Gewitterpotenzial ab ${WEEKDAY(firstHigh.time)}.`;
    const firstMod = data.find((d) => (d.median ?? 0) >= 500);
    if (firstMod) return `Erhöhtes Gewitterpotenzial ab ${WEEKDAY(firstMod.time)}.`;
    return "Kein markantes Gewitterpotenzial in den nächsten 14 Tagen.";
  }, [data]);

  const info = (
    <InfoPopover title="Gewittertrend 7–14 Tage">
      Ab etwa Tag 5 stützt sich der Trend nur noch auf GFS und ECMWF, die Unsicherheit steigt mit
      der Vorlaufzeit. Ein einzelner CAPE-Peak weit draußen ist ein Signal, keine Garantie.
    </InfoPopover>
  );

  return (
    <DataCard
      title="Gewittertrend 7–14 Tage"
      subtitle="CAPE-Median und Spannweite aus GFS, ECMWF IFS und ICON-Seamless."
      action={info}
    >
      {subset.length === 0 || data.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Keine Langfrist-CAPE-Daten verfügbar.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {headline && (
            <p className="text-sm font-medium tracking-tight text-foreground">{headline}</p>
          )}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-border"
                  opacity={0.4}
                />
                <XAxis
                  dataKey="time"
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleDateString("de-DE", {
                      weekday: "short",
                      day: "2-digit",
                    })
                  }
                  tick={{ fontSize: 10 }}
                  minTickGap={32}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  width={40}
                  label={{
                    value: "J/kg",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 10,
                    offset: 12,
                    fill: "currentColor",
                  }}
                />
                <Tooltip
                  labelFormatter={(v) =>
                    new Date(v as string).toLocaleString("de-DE", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                    })
                  }
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
                      return [`${Math.round(v[0])} – ${Math.round(v[0] + v[1])}`, "Spannweite"];
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
                  label={{ value: "mäßig", fontSize: 10, fill: "currentColor", position: "right" }}
                />
                <ReferenceLine
                  y={1500}
                  stroke="currentColor"
                  className="text-destructive"
                  strokeDasharray="3 3"
                  label={{ value: "hoch", fontSize: 10, fill: "currentColor", position: "right" }}
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
      )}
    </DataCard>
  );
}