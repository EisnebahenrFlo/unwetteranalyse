import { DataCard } from "@/components/common/DataCard";
import { ValueWithUnit } from "@/components/common/ValueWithUnit";
import { InfoPopover } from "@/components/common/InfoPopover";
import { useSettings } from "@/hooks/use-settings";
import { formatTemp, formatWind, formatPercent, formatPressure, formatPrecip, windDirectionLabel, weatherCodeLabel } from "@/lib/weather/format";
import type { CurrentConditions as CC, DataMeta } from "@/lib/weather/types";
import { MeteoconIcon, isNightAt } from "@/components/weather/MeteoconIcon";

export function CurrentConditions({ current, meta, fallbackLabel }: { current?: CC; meta: DataMeta; fallbackLabel?: string }) {
  const [settings] = useSettings();
  if (!current || !Number.isFinite(current.temperatureC)) {
    return (
      <DataCard title="Aktuelle Lage" meta={meta}>
        <div className="text-sm text-muted-foreground">{fallbackLabel ?? "Keine aktuellen Daten verfügbar."}</div>
      </DataCard>
    );
  }
  const night = isNightAt(current.observedAt);
  const windKmh = current.windSpeedMs != null ? (current.windSpeedMs * 3.6) : null;
  const gustKmh = current.windGustMs != null ? (current.windGustMs * 3.6) : null;
  const windText = windKmh != null
    ? `${windKmh.toFixed(0)} km/h${current.windDirectionDeg != null ? ` aus ${windDirectionLabel(current.windDirectionDeg)}` : ""}`
    : "—";
  const gustText = gustKmh != null ? `Böen ${gustKmh.toFixed(0)} km/h` : current.windDirectionDeg != null ? `Richtung ${windDirectionLabel(current.windDirectionDeg)}` : undefined;
  return (
    <DataCard
      title="Aktuelle Lage"
      subtitle={weatherCodeLabel(current.weatherCode)}
      meta={meta}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 items-center gap-3">
          <MeteoconIcon code={current.weatherCode} isNight={night} label={weatherCodeLabel(current.weatherCode)} className="h-20 w-20 md:h-24 md:w-24" />
          <ValueWithUnit
            value={formatTemp(current.temperatureC, settings.tempUnit).split(" ")[0]}
            unit={`°${settings.tempUnit}`}
            size="xl"
            hint={current.apparentTemperatureC != null ? `gefühlt ${formatTemp(current.apparentTemperatureC, settings.tempUnit)}` : undefined}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
        <WindField
          unit={settings.windUnit}
          speedMs={current.windSpeedMs}
          gustMs={current.windGustMs}
          dirDeg={current.windDirectionDeg}
        />
        <Field label="Taupunkt" value={formatTemp(current.dewPointC, settings.tempUnit)}
          hint={current.relativeHumidity != null ? `${formatPercent(current.relativeHumidity)} relative Feuchte` : undefined}
          info={{ title: "Taupunkt", text: "Temperatur, bei der Wasserdampf kondensiert. Liegt sie nahe an der Lufttemperatur, ist es schwül und Nebel/Tau wahrscheinlich." }}
        />
        <Field label="Niederschlag" value={formatPrecip(current.precipitationMm)}
          hint={current.pressureHpa != null ? `${formatPressure(current.pressureHpa)} Luftdruck` : undefined}
          info={{ title: "Niederschlag (10 min)", text: "Beobachteter Niederschlag der letzten 10 Minuten. Eine erste Einordnung der aktuellen Lage, nicht der Tagessumme." }}
        />
        </div>
      </div>
    </DataCard>
  );
}

function WindField({ speedMs, gustMs, dirDeg, unit }: { speedMs?: number; gustMs?: number; dirDeg?: number; unit: "kmh" | "ms" | "bft" }) {
  const value = formatWind(speedMs, unit);
  const [num, ...rest] = value.split(" ");
  const unitPart = rest.join(" ");
  const dir = dirDeg != null ? windDirectionLabel(dirDeg) : null;
  const gust = gustMs != null ? formatWind(gustMs, unit) : null;
  const hint = [dir ? `aus ${dir}` : null, gust ? `Böen ${gust}` : null].filter(Boolean).join(" · ") || undefined;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        Wind
        <InfoPopover title="Wind & Böen">Mittlerer Wind in 10 m Höhe; Böen sind die Spitzenwerte der letzten Stunde und entscheiden über DWD-Warnschwellen.</InfoPopover>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{num}</span>
        {unitPart && <span className="text-xs text-muted-foreground">{unitPart}</span>}
        {dir && <span className="ml-1 rounded border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">{dir}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Field({ label, value, hint, info }: { label: string; value: string; hint?: string; info?: { title: string; text: string } }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
        {info && <InfoPopover title={info.title}>{info.text}</InfoPopover>}
      </div>
      <ValueWithUnit value={value} size="md" hint={hint} />
    </div>
  );
}
