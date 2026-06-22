import { Link } from "@tanstack/react-router";
import { DataCard } from "@/components/common/DataCard";
import { WeatherMap } from "@/components/map/WeatherMap";
import { CurrentConditions } from "@/components/dashboard/CurrentConditions";
import { useSettings } from "@/hooks/use-settings";
import { formatPressure, formatWind, windDirectionLabel } from "@/lib/weather/format";
import type { CurrentConditions as CC, DataMeta, ForecastBundle, GeoPoint } from "@/lib/weather/types";
import { ArrowRight } from "lucide-react";

interface Props {
  point: GeoPoint;
  bundle: ForecastBundle;
  bsCurrent: CC | null | undefined;
  bsMeta: DataMeta;
}

/**
 * Live-Signale: Punkt-Beobachtungen + Wind/Böen + Druck-Tendenz + Radar.
 * Mobile-first: Zahlen zuerst, Karte unten. Beobachtung wird mit Modell-
 * werten zusammengeführt, sodass fehlende Felder (z. B. weatherCode,
 * apparentTemperatureC) nicht zu Lücken in der UI führen.
 */
export function LiveSignals({ point, bundle, bsCurrent, bsMeta }: Props) {
  const merged = mergeObservationWithModel(bsCurrent, bundle.current);
  const metaForDisplay = bsCurrent ? bsMeta : bundle.meta;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="flex flex-col gap-3 lg:col-span-4 lg:order-2">
        <CurrentConditions current={merged} meta={metaForDisplay} />
        <PressureTendency bundle={bundle} />
        <WindCard current={merged} hasObservation={!!bsCurrent} />
      </div>
      <div className="lg:col-span-8 lg:order-1">
        <DataCard
          title="DWD Radar"
          subtitle="Beobachtetes Niederschlagsechobild, animiert."
          action={<Link to="/map" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Vollbild <ArrowRight className="h-3 w-3" /></Link>}
        >
          <div className="-mx-1">
            <WeatherMap center={point} layer="radar" />
          </div>
        </DataCard>
      </div>
    </div>
  );
}

/** Beobachtung hat Priorität, fehlt ein Feld wird Modell als Fallback genutzt.
 *  Damit verschwinden keine Werte, nur weil Bright Sky ein Feld leer lässt. */
function mergeObservationWithModel(obs: CC | null | undefined, model: CC | undefined): CC | undefined {
  if (!obs) return model;
  if (!model) return obs;
  const pick = <K extends keyof CC>(key: K): CC[K] => {
    const v = obs[key];
    if (v == null) return model[key];
    if (typeof v === "number" && Number.isNaN(v)) return model[key];
    return v;
  };
  return {
    observedAt: obs.observedAt,
    temperatureC: pick("temperatureC") as number,
    apparentTemperatureC: pick("apparentTemperatureC"),
    dewPointC: pick("dewPointC"),
    relativeHumidity: pick("relativeHumidity"),
    windSpeedMs: pick("windSpeedMs") as number,
    windGustMs: pick("windGustMs"),
    windDirectionDeg: pick("windDirectionDeg"),
    precipitationMm: pick("precipitationMm"),
    pressureHpa: pick("pressureHpa"),
    cloudCover: pick("cloudCover"),
    weatherCode: pick("weatherCode"),
  };
}

function PressureTendency({ bundle }: { bundle: ForecastBundle }) {
  const series = bundle.hourly.slice(0, 6).map((h) => h.pressureHpa).filter((v): v is number => v != null);
  const first = series[0];
  const last = series[series.length - 1];
  const delta = first != null && last != null ? last - first : null;
  const dir = delta == null ? "—" : delta >= 0.5 ? "steigend" : delta <= -0.5 ? "fallend" : "stabil";
  return (
    <DataCard title="Druck-Tendenz" subtitle="Nächste 6 Stunden gegen jetzt." meta={bundle.meta}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-3">
        <div className="font-mono text-2xl font-semibold tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
          {first != null ? formatPressure(first) : "—"}
        </div>
        <div className="min-w-0 text-[12px]">
          <div className="font-medium text-foreground">{dir}</div>
          {delta != null && (
            <div className="text-muted-foreground">
              Δ {(delta > 0 ? "+" : "")}{delta.toFixed(1)} hPa
            </div>
          )}
        </div>
      </div>
    </DataCard>
  );
}

function WindCard({ current, hasObservation }: { current?: CC; hasObservation: boolean }) {
  const [settings] = useSettings();
  if (!current) {
    return (
      <DataCard title="Wind & Böen"><div className="text-sm text-muted-foreground">Keine Beobachtung verfügbar.</div></DataCard>
    );
  }
  const dir = current.windDirectionDeg != null ? windDirectionLabel(current.windDirectionDeg) : null;
  const subtitle = hasObservation
    ? "Punktbeobachtung der nächsten DWD-Station."
    : "Keine aktuelle DWD-Beobachtung — Modellwert (Open-Meteo).";
  return (
    <DataCard title="Wind & Böen" subtitle={subtitle}>
      <div className="grid grid-cols-2 gap-3">
        <Cell label="Mittlerer Wind" value={Number.isFinite(current.windSpeedMs) ? formatWind(current.windSpeedMs, settings.windUnit) : "—"} hint={dir ? `aus ${dir}` : undefined} />
        <Cell label="Spitzenböe" value={current.windGustMs != null ? formatWind(current.windGustMs, settings.windUnit) : "—"} hint="letzte Stunde" />
      </div>
    </DataCard>
  );
}

function Cell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-xl font-semibold tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}