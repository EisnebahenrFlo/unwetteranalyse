import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { WarnBadge } from "@/components/common/WarnBadge";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ModelRankRow } from "@/lib/weather/analysis/model-consensus";
import { severeScore } from "@/lib/weather/analysis/convection";

interface Props {
  row: ModelRankRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function bewertung(r: ModelRankRow): string {
  if (r.worstScore >= 70)
    return "Modell zeigt klare Unwetter-Signatur: hohe CAPE und/oder schwere Böen.";
  if (r.worstScore >= 45)
    return "Markantes konvektives Signal — Gewitter mit Begleiterscheinungen möglich.";
  if (r.worstScore >= 20) return "Schwache konvektive Signale, einzelne Schauer/Gewitter denkbar.";
  return "Modell ohne nennenswerte konvektive Signatur in den nächsten 24 h.";
}

export function ModelDetailDrawer({ row, open, onOpenChange }: Props) {
  if (!row) return null;
  const data = row.hourly.map((h) => ({
    time: h.time,
    score: severeScore(h).value,
  }));
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="text-left">
          <div className="flex items-center gap-2">
            <DrawerTitle className="truncate text-base">{row.label}</DrawerTitle>
            {row.level !== "none" && <WarnBadge severity={row.level} />}
          </div>
          <DrawerDescription>{bewertung(row)}</DrawerDescription>
        </DrawerHeader>

        <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-4">
          <KV label="Score" value={`${row.worstScore}`} />
          <KV
            label="CAPE max"
            value={row.capeMax != null ? `${row.capeMax.toFixed(0)} J/kg` : "—"}
          />
          <KV label="LI min" value={row.liMin != null ? row.liMin.toFixed(1) : "—"} />
          <KV label="Böen max" value={`${(row.gustMaxMs * 3.6).toFixed(0)} km/h`} />
          <KV label="Regen max" value={`${row.precipMaxMm.toFixed(1)} mm`} />
          <KV label="Gewitter" value={`${Math.round(row.thunderProbMax * 100)} %`} />
          {row.resolutionKm != null && <KV label="Auflösung" value={`${row.resolutionKm} km`} />}
        </div>

        <div className="px-4 pb-6 pt-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Score-Verlauf (24 h)
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleTimeString("de-DE", { hour: "2-digit" })
                  }
                  interval={3}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  width={28}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  domain={[0, 100]}
                />
                <Tooltip
                  labelFormatter={(v) =>
                    new Date(v as string).toLocaleString("de-DE", {
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
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="currentColor"
                  fill="url(#scoreGrad)"
                  strokeWidth={1.5}
                  className="text-foreground"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className="mt-0.5 truncate text-sm font-semibold tabular-nums"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </div>
    </div>
  );
}
