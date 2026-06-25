import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { ModelSeries } from "@/lib/weather/types";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  buildCorridor,
  CORE_MODEL_IDS,
  type ConsensusMetric,
} from "@/lib/weather/analysis/model-consensus";
import { cn } from "@/lib/utils";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface Props {
  series: ModelSeries[];
  metric: ConsensusMetric;
  unitLabel: string;
}

export function FocusedCompareChart({ series, metric, unitLabel }: Props) {
  const now = useLiveNow();
  const [showAll, setShowAll] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visibleSeries = useMemo(() => {
    const filtered = showAll ? series : series.filter((s) => CORE_MODEL_IDS.includes(s.model));
    return filtered.filter((s) => !hidden.has(s.model));
  }, [series, showAll, hidden]);

  const focusList = showAll ? series : series.filter((s) => CORE_MODEL_IDS.includes(s.model));

  const corridor = useMemo(() => buildCorridor(series, metric, now, 72), [series, metric, now]);

  const data = useMemo(() => {
    return corridor.map((c) => {
      const row: Record<string, number | string | [number, number] | null> = {
        time: c.time,
        _band: c.band,
        _median: c.median,
      };
      for (const s of visibleSeries) {
        const p = s.hourly.find((h) => h.time === c.time);
        const v = p?.[metric];
        row[s.label] =
          v != null && Number.isFinite(v as number) ? Number((v as number).toFixed(2)) : null;
      }
      return row;
    });
  }, [corridor, visibleSeries, metric]);

  if (data.length === 0) {
    return <div className="text-sm text-muted-foreground">Keine Daten verfügbar.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
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
                new Date(v).toLocaleTimeString("de-DE", { hour: "2-digit" })
              }
              tick={{ fontSize: 10 }}
              interval={5}
              stroke="currentColor"
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              width={36}
              label={{
                value: unitLabel,
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
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--popover)",
              }}
              itemSorter={(item) => -(item.value as number)}
              formatter={(value, name) => {
                if (typeof name === "string" && name.startsWith("_"))
                  return [null as unknown as string, ""];
                return [value as number, name as string];
              }}
            />
            {/* Konsens-Korridor (min..max) */}
            <Area
              type="monotone"
              dataKey="_band"
              stroke="none"
              fill="currentColor"
              className="text-muted-foreground"
              fillOpacity={0.12}
              isAnimationActive={false}
              activeDot={false}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="_median"
              stroke="currentColor"
              className="text-muted-foreground"
              strokeDasharray="4 3"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              activeDot={false}
              legendType="none"
            />
            {visibleSeries.map((s, i) => (
              <Line
                key={s.model}
                type="monotone"
                dataKey={s.label}
                stroke={COLORS[i % COLORS.length]}
                dot={false}
                strokeWidth={1.8}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {focusList.map((s, i) => {
          const isHidden = hidden.has(s.model);
          return (
            <button
              key={s.model}
              type="button"
              onClick={() => {
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.model)) next.delete(s.model);
                  else next.add(s.model);
                  return next;
                });
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[11px] transition-opacity",
                isHidden ? "opacity-40" : "opacity-100",
              )}
              aria-pressed={!isHidden}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Hintergrund: Spannweite + Median über {series.length} Modelle</span>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="rounded-md border border-border/60 px-2 py-1 text-foreground transition-colors hover:bg-accent"
        >
          {showAll ? "Nur Kernmodelle" : "Alle Modelle anzeigen"}
        </button>
      </div>
    </div>
  );
}
