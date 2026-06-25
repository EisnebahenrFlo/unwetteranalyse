import { useState } from "react";
import { DataCard } from "@/components/common/DataCard";
import { InfoPopover } from "@/components/common/InfoPopover";
import { SegmentedTabs } from "@/components/common/SegmentedTabs";
import { useSettings } from "@/hooks/use-settings";
import {
  formatTemp,
  formatWind,
  formatPercent,
  formatPressure,
  formatPrecip,
  windDirectionLabel,
  weatherCodeLabel,
} from "@/lib/weather/format";
import type { CurrentConditions as CC, DataMeta, HourlyPoint } from "@/lib/weather/types";
import { MeteoconIcon, isNightAt } from "@/components/weather/MeteoconIcon";
import { Thermometer, Wind, CloudRain, Gauge } from "@/components/icons";
import { cn } from "@/lib/utils";

type TabId = "temp" | "wind" | "precip" | "pressure";

interface Props {
  current?: CC;
  meta: DataMeta;
  fallbackLabel?: string;
  /** Optionale stündliche Werte zur Berechnung der Druck-Tendenz und Niederschlagschance. */
  hourly?: HourlyPoint[];
}

export function CurrentConditions({ current, meta, fallbackLabel, hourly }: Props) {
  const [settings] = useSettings();
  const [tab, setTab] = useState<TabId>("temp");

  if (!current || !Number.isFinite(current.temperatureC)) {
    return (
      <DataCard title="Aktuelle Lage" meta={meta}>
        <div className="text-sm text-muted-foreground">
          {fallbackLabel ?? "Keine aktuellen Daten verfügbar."}
        </div>
      </DataCard>
    );
  }

  const night = isNightAt(current.observedAt);
  const condition = weatherCodeLabel(current.weatherCode);

  return (
    <DataCard title="Aktuelle Lage" subtitle={condition} meta={meta}>
      <div className="flex flex-col gap-4">
        <Hero current={current} night={night} condition={condition} tempUnit={settings.tempUnit} />
        <SegmentedTabs<TabId>
          size="sm"
          tabs={[
            { id: "temp", label: "Temperatur", icon: <Thermometer className="h-3.5 w-3.5" /> },
            { id: "wind", label: "Wind", icon: <Wind className="h-3.5 w-3.5" /> },
            { id: "precip", label: "Niederschlag", icon: <CloudRain className="h-3.5 w-3.5" /> },
            { id: "pressure", label: "Druck & Wolken", icon: <Gauge className="h-3.5 w-3.5" /> },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div role="tabpanel" className="min-h-[88px]">
          {tab === "temp" && <TempSection current={current} unit={settings.tempUnit} />}
          {tab === "wind" && <WindSection current={current} unit={settings.windUnit} />}
          {tab === "precip" && <PrecipSection current={current} hourly={hourly} />}
          {tab === "pressure" && <PressureSection current={current} hourly={hourly} />}
        </div>
      </div>
    </DataCard>
  );
}

/* ------------------------------ Hero ------------------------------ */

function Hero({
  current,
  night,
  condition,
  tempUnit,
}: {
  current: CC;
  night: boolean;
  condition: string;
  tempUnit: "C" | "F";
}) {
  const tempNum = formatTemp(current.temperatureC, tempUnit).split(" ")[0];
  return (
    <div className="flex items-center gap-3">
      <MeteoconIcon
        code={current.weatherCode}
        isNight={night}
        label={condition}
        className="h-20 w-20 shrink-0 md:h-24 md:w-24"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-mono text-5xl font-semibold leading-none tracking-tight tabular-nums text-foreground md:text-6xl"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {tempNum}
          </span>
          <span className="text-base text-muted-foreground">°{tempUnit}</span>
        </div>
        {current.apparentTemperatureC != null && (
          <div className="mt-1 text-xs text-muted-foreground">
            gefühlt {formatTemp(current.apparentTemperatureC, tempUnit)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Sections ------------------------------ */

function TempSection({ current, unit }: { current: CC; unit: "C" | "F" }) {
  const muggy =
    current.dewPointC != null && current.dewPointC >= 16
      ? current.dewPointC >= 20
        ? "drückend schwül"
        : "schwül"
      : null;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
      <Field label="Aktuell" value={formatTemp(current.temperatureC, unit)} />
      <Field label="Gefühlt" value={formatTemp(current.apparentTemperatureC, unit)} />
      <Field
        label="Taupunkt"
        value={formatTemp(current.dewPointC, unit)}
        hint={muggy ?? undefined}
        info={{
          title: "Taupunkt",
          text: "Temperatur, bei der Wasserdampf kondensiert. Nahe an der Lufttemperatur = schwül, Nebel/Tau wahrscheinlich.",
        }}
      />
      <Field label="Rel. Feuchte" value={formatPercent(current.relativeHumidity)} />
    </div>
  );
}

function WindSection({ current, unit }: { current: CC; unit: "kmh" | "ms" | "bft" }) {
  const dir = current.windDirectionDeg;
  const dirLabel = dir != null ? windDirectionLabel(dir) : null;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
      <Compass deg={dir ?? null} />
      <Field
        label="Mittlerer Wind"
        value={formatWind(current.windSpeedMs, unit)}
        hint={dirLabel ? `aus ${dirLabel}` : undefined}
        info={{
          title: "Mittlerer Wind",
          text: "10-Minuten-Mittel in 10 m Höhe. Grundlage für Beaufort-Einstufung.",
        }}
      />
      <Field
        label="Spitzenböe"
        value={formatWind(current.windGustMs, unit)}
        hint="letzte Stunde"
        info={{
          title: "Böen",
          text: "Spitzenwerte der letzten Stunde. Entscheiden über DWD-Warnschwellen ab 50 km/h.",
        }}
      />
    </div>
  );
}

function PrecipSection({ current, hourly }: { current: CC; hourly?: HourlyPoint[] }) {
  const nextProb = hourly
    ?.slice(0, 3)
    .find((h) => h.precipitationProbability != null)?.precipitationProbability;
  const next6Sum = hourly?.slice(0, 6).reduce((s, h) => s + (h.precipitationMm ?? 0), 0);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
      <Field
        label="Letzte 10 min"
        value={formatPrecip(current.precipitationMm)}
        info={{
          title: "Niederschlag (10 min)",
          text: "Beobachteter Niederschlag der letzten 10 Minuten. Erste Einordnung der aktuellen Lage.",
        }}
      />
      <Field
        label="Nächste 6 h"
        value={next6Sum != null ? formatPrecip(next6Sum) : "—"}
        hint="Summe Modell"
      />
      <Field
        label="Schauer­chance"
        value={nextProb != null ? formatPercent(nextProb) : "—"}
        hint="kommende Stunden"
      />
    </div>
  );
}

function PressureSection({ current, hourly }: { current: CC; hourly?: HourlyPoint[] }) {
  const series =
    hourly
      ?.slice(0, 4)
      .map((h) => h.pressureHpa)
      .filter((v): v is number => v != null) ?? [];
  const delta =
    current.pressureHpa != null && series.length >= 2
      ? series[series.length - 1] - current.pressureHpa
      : null;
  const trend =
    delta == null ? null : delta >= 0.7 ? "steigend" : delta <= -0.7 ? "fallend" : "stabil";
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
      <Field
        label="Luftdruck"
        value={formatPressure(current.pressureHpa)}
        hint={trend ?? undefined}
        info={{
          title: "Luftdruck",
          text: "Druck auf Meereshöhe reduziert. Fallend = oft Wetterverschlechterung, steigend = Beruhigung.",
        }}
      />
      <Field
        label="Tendenz 3 h"
        value={delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} hPa`}
        hint="Modellprognose"
      />
      <Field label="Bewölkung" value={formatPercent(current.cloudCover)} />
    </div>
  );
}

/* ------------------------------ Bausteine ------------------------------ */

function Field({
  label,
  value,
  hint,
  info,
}: {
  label: string;
  value: string;
  hint?: string;
  info?: { title: string; text: string };
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
        {info && <InfoPopover title={info.title}>{info.text}</InfoPopover>}
      </div>
      <div
        className="font-mono text-2xl font-semibold leading-none tabular-nums text-foreground"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Compass({ deg }: { deg: number | null }) {
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center">
      <div className="relative h-16 w-16 rounded-full border border-border bg-muted/40">
        <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground">
          N
        </span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground">
          S
        </span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">
          W
        </span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">
          O
        </span>
        {deg != null && (
          <div
            className={cn(
              "absolute left-1/2 top-1/2 h-7 w-0.5 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-primary",
            )}
            style={{
              transform: `translate(-50%, -100%) rotate(${deg}deg)`,
              transformOrigin: "50% 100%",
            }}
          />
        )}
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
      </div>
    </div>
  );
}
