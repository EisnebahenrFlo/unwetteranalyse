import { DataCard } from "@/components/common/DataCard";
import { InfoPopover } from "@/components/common/InfoPopover";
import { WarnBadge } from "@/components/common/WarnBadge";
import { ValueWithUnit } from "@/components/common/ValueWithUnit";
import { Zap, CloudRain, Wind, Snowflake } from "lucide-react";
import type { ForecastBundle, AlertSeverity } from "@/lib/weather/types";
import { summarizeConvection, summarizeWinter } from "@/lib/weather/analysis/situation";
import { formatHour } from "@/lib/weather/format";
import { cn } from "@/lib/utils";

/**
 * Gewitter- & Unwetter-Panel.
 * Bündelt die wichtigsten Konvektions- und Unwetter-Parameter der nächsten 24 h
 * mit einer Einordnung nach DWD-orientierten Schwellen.
 */
export function SevereWeatherPanel({ bundle }: { bundle: ForecastBundle }) {
  const horizon = bundle.hourly.slice(0, 24);
  const conv = summarizeConvection(horizon);
  const winter = summarizeWinter(horizon);

  const gustPeak = peak(horizon.map((h) => ({ v: h.windGustMs, t: h.time })));
  const rainPeak = peak(horizon.map((h) => ({ v: h.precipitationMm, t: h.time })));

  const gustLevel: AlertSeverity | "none" =
    !gustPeak ? "none" :
    gustPeak.v >= 33 ? "extreme" :
    gustPeak.v >= 25 ? "severe" :
    gustPeak.v >= 18 ? "moderate" :
    gustPeak.v >= 14 ? "minor" : "none";

  const rainLevel: AlertSeverity | "none" =
    !rainPeak ? "none" :
    rainPeak.v >= 40 ? "severe" :
    rainPeak.v >= 25 ? "moderate" :
    rainPeak.v >= 15 ? "minor" : "none";

  return (
    <DataCard
      title="Gewitter & Unwetter (24 h)"
      subtitle="Konvektions- und Unwetter-Parameter, eingeordnet nach DWD-Schwellen."
      meta={bundle.meta}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          icon={<Zap className="h-4 w-4" />}
          label="CAPE max"
          value={conv.capeMax != null ? conv.capeMax.toFixed(0) : "—"}
          unit="J/kg"
          level={conv.level}
          hint={conv.liMin != null ? `LI min ${conv.liMin.toFixed(1)}` : undefined}
          info={{
            title: "CAPE & Lifted Index",
            text: "CAPE misst die verfügbare Energie für Aufwinde. ≥ 500 mäßig, ≥ 1500 hoch, ≥ 2500 extrem. LI < −2 deutet auf Gewitter, < −5 auf kräftige Gewitter hin.",
          }}
        />
        <Tile
          icon={<CloudRain className="h-4 w-4" />}
          label="Regen max (1 h)"
          value={rainPeak ? rainPeak.v.toFixed(1) : "—"}
          unit="mm/h"
          level={rainLevel}
          hint={rainPeak ? `um ${formatHour(rainPeak.t)}` : undefined}
          info={{
            title: "Starkregen",
            text: "DWD-Schwellen: ≥ 15 markant, ≥ 25 heftig, ≥ 40 extrem. Werte beziehen sich auf eine Stunde.",
          }}
        />
        <Tile
          icon={<Wind className="h-4 w-4" />}
          label="Böen max"
          value={gustPeak ? (gustPeak.v * 3.6).toFixed(0) : "—"}
          unit="km/h"
          level={gustLevel}
          hint={gustPeak ? `um ${formatHour(gustPeak.t)}` : undefined}
          info={{
            title: "Windböen",
            text: "DWD-Stufen: ≥ 50 km/h markant, ≥ 65 Sturmböen, ≥ 90 schwerer Sturm, ≥ 118 Orkan.",
          }}
        />
        <Tile
          icon={<Snowflake className="h-4 w-4" />}
          label="Neuschnee 24 h"
          value={winter.snowfallSumCm > 0 ? winter.snowfallSumCm.toFixed(1) : "—"}
          unit="cm"
          level={winter.snowfallSumCm >= 15 ? "moderate" : winter.snowfallSumCm >= 5 ? "minor" : "none"}
          hint={winter.freezingLevelMinM != null ? `0 °C bei ${Math.round(winter.freezingLevelMinM)} m` : undefined}
          info={{
            title: "Schneefall & Schneefallgrenze",
            text: "Summe der nächsten 24 h plus tiefste Höhe der 0-°C-Grenze. Wichtig zur Einordnung, ob Niederschlag als Schnee fällt.",
          }}
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Einschätzung: </span>
        {conv.text}
      </p>
    </DataCard>
  );
}

function peak(series: Array<{ v?: number; t: string }>) {
  let best: { v: number; t: string } | null = null;
  for (const p of series) {
    if (p.v == null || Number.isNaN(p.v)) continue;
    if (!best || p.v > best.v) best = { v: p.v, t: p.t };
  }
  return best;
}

const LEVEL_STYLES: Record<AlertSeverity | "none", string> = {
  none: "border-border bg-background/50",
  minor: "border-warn-minor/40 bg-warn-minor/10",
  moderate: "border-warn-moderate/40 bg-warn-moderate/10",
  severe: "border-warn-severe/40 bg-warn-severe/10",
  extreme: "border-warn-extreme/40 bg-warn-extreme/10",
};

function Tile({
  icon, label, value, unit, level, hint, info,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  level: AlertSeverity | "none";
  hint?: string;
  info: { title: string; text: string };
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-md border p-3", LEVEL_STYLES[level])}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          {icon}
          <span>{label}</span>
          <InfoPopover title={info.title}>{info.text}</InfoPopover>
        </div>
        {level !== "none" && <WarnBadge severity={level} />}
      </div>
      <ValueWithUnit value={value} unit={unit} size="lg" hint={hint} />
    </div>
  );
}
