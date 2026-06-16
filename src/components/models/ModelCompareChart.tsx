import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import type { ModelSeries } from "@/lib/weather/types";
import { formatHour } from "@/lib/weather/format";

const COLORS = ["#2b6cb0", "#dd6b20", "#2f855a", "#805ad5", "#c53030", "#0987a0"];

interface Props {
  series: ModelSeries[];
  metric: "temperatureC" | "precipitationMm" | "windGustMs";
  unitLabel: string;
}

export function ModelCompareChart({ series, metric, unitLabel }: Props) {
  const all = series.flatMap((s) => s.hourly.map((h) => h.time));
  const uniqueTimes = Array.from(new Set(all)).sort();
  const data = uniqueTimes.slice(0, 72).map((t) => {
    const row: Record<string, number | string> = { time: t };
    for (const s of series) {
      const point = s.hourly.find((h) => h.time === t);
      const v = point?.[metric];
      if (v != null && !Number.isNaN(v as number)) row[s.label] = Number((v as number).toFixed(2));
    }
    return row;
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" opacity={0.5} />
          <XAxis dataKey="time" tickFormatter={formatHour} tick={{ fontSize: 10 }} interval={5} />
          <YAxis tick={{ fontSize: 10 }} label={{ value: unitLabel, angle: -90, position: "insideLeft", fontSize: 10 }} />
          <Tooltip
            labelFormatter={(v) => new Date(v as string).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
            contentStyle={{ fontSize: 11, borderRadius: 6 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Line
              key={s.model}
              type="monotone"
              dataKey={s.label}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={1.6}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
