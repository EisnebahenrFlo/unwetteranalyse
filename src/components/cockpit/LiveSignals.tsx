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
 * Live-Signale: Radar + Punkt-Beobachtungen + Wind/Böen + Druck-Tendenz.
 * Klar abgetrennt von Bewertung und Modelltrend.
 */
export function LiveSignals({ point, bundle, bsCurrent, bsMeta }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="lg:col-span-8">
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

      <div className="flex flex-col gap-3 lg:col-span-4">
        <CurrentConditions current={bsCurrent ?? bundle.current} meta={bsMeta} />
        <PressureTendency bundle={bundle} />
        <WindCard current={bsCurrent ?? bundle.current} />
      </div>
    </div>
  );
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

function WindCard({ current }: { current?: CC }) {
  const [settings] = useSettings();
  if (!current) {
    return (
      <DataCard title="Wind & Böen"><div className="text-sm text-muted-foreground">Keine Beobachtung verfügbar.</div></DataCard>
    );
  }
  const dir = current.windDirectionDeg != null ? windDirectionLabel(current.windDirectionDeg) : null;
  return (
    <DataCard title="Wind & Böen" subtitle="Punktbeobachtung der nächsten DWD-Station.">
      <div className="grid grid-cols-2 gap-3">
        <Cell label="Mittlerer Wind" value={formatWind(current.windSpeedMs, settings.windUnit)} hint={dir ? `aus ${dir}` : undefined} />
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