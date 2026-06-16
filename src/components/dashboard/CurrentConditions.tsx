import { DataCard } from "@/components/common/DataCard";
import { ValueWithUnit } from "@/components/common/ValueWithUnit";
import { InfoPopover } from "@/components/common/InfoPopover";
import { useSettings } from "@/hooks/use-settings";
import { formatTemp, formatWind, formatPercent, formatPressure, formatPrecip, windDirectionLabel, weatherCodeLabel } from "@/lib/weather/format";
import type { CurrentConditions as CC, DataMeta } from "@/lib/weather/types";

export function CurrentConditions({ current, meta, fallbackLabel }: { current?: CC; meta: DataMeta; fallbackLabel?: string }) {
  const [settings] = useSettings();
  if (!current) {
    return (
      <DataCard title="Aktuelle Lage" meta={meta}>
        <div className="text-sm text-muted-foreground">{fallbackLabel ?? "Keine aktuellen Daten verfügbar."}</div>
      </DataCard>
    );
  }
  return (
    <DataCard
      title="Aktuelle Lage"
      subtitle={weatherCodeLabel(current.weatherCode)}
      meta={meta}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <ValueWithUnit
          value={formatTemp(current.temperatureC, settings.tempUnit).split(" ")[0]}
          unit={`°${settings.tempUnit}`}
          size="xl"
          hint={current.apparentTemperatureC != null ? `gefühlt ${formatTemp(current.apparentTemperatureC, settings.tempUnit)}` : undefined}
        />
        <Field label="Wind" value={formatWind(current.windSpeedMs, settings.windUnit)}
          hint={current.windGustMs != null ? `Böen ${formatWind(current.windGustMs, settings.windUnit)} aus ${windDirectionLabel(current.windDirectionDeg)}` : undefined}
          info={{ title: "Wind & Böen", text: "Der mittlere Wind in 10 m Höhe und die Spitzenböe der letzten Stunde. Böen entscheiden über DWD-Warnschwellen." }}
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
    </DataCard>
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
