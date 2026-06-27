import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ForecastFieldMap, type ForecastFieldMapHandle } from "./ForecastFieldMap";
import { fetchTemperatureField } from "@/lib/weather/maps/temperature-field";
import { sampleField, TEMP_STOPS } from "@/lib/weather/maps/field-render";
import { cn } from "@/lib/utils";

const CENTER = { lat: 47.8, lon: 11.5 };

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}
function gradientCss(): string {
  const min = TEMP_STOPS[0].t;
  const max = TEMP_STOPS[TEMP_STOPS.length - 1].t;
  const parts = TEMP_STOPS.map((s) => {
    const [r, g, b] = s.c;
    const pct = ((s.t - min) / (max - min)) * 100;
    return `rgb(${r},${g},${b}) ${pct.toFixed(0)}%`;
  });
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

export function TemperatureMapCockpit() {
  const mapRef = useRef<ForecastFieldMapHandle>(null);
  const [step, setStep] = useState(0);
  const [opacity, setOpacity] = useState(0.72);
  const [pick, setPick] = useState<{ lat: number; lon: number } | null>(null);

  const q = useQuery({
    queryKey: ["temp-field"],
    queryFn: ({ signal }) => fetchTemperatureField(signal),
    refetchInterval: 10 * 60_000,
    staleTime: 8 * 60_000,
  });

  const field = q.data;
  const startIdx = useMemo(() => {
    if (!field || field.times.length === 0) return 0;
    const t0 = new Date(field.times[0]).getTime();
    return Math.max(0, Math.round((Date.now() - t0) / 3_600_000));
  }, [field]);
  const hourIdx = useMemo(() => {
    if (!field) return 0;
    return Math.min(field.times.length - 1, startIdx + step);
  }, [field, startIdx, step]);

  useEffect(() => {
    if (field) mapRef.current?.update(field, hourIdx, opacity);
  }, [field, hourIdx, opacity]);

  const pickVal = useMemo(() => {
    if (!field || !pick) return null;
    return sampleField(field, hourIdx, pick.lat, pick.lon);
  }, [field, pick, hourIdx]);

  const activeTime = field?.times[hourIdx];
  const updated = field
    ? new Date(field.fetchedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="relative -mx-3 md:-mx-6">
      <div className="relative h-[calc(100vh-12rem)] min-h-[520px] w-full overflow-hidden bg-muted md:h-[calc(100vh-10rem)]">
        <ForecastFieldMap
          ref={mapRef}
          initialCenter={CENTER}
          initialZoom={5.2}
          onPick={(lat, lon) => setPick({ lat, lon })}
        />

        <div className="pointer-events-auto absolute left-3 top-3 z-10 md:left-6 md:max-w-[640px]">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/70 p-2 shadow-elegant backdrop-blur-xl">
            <span className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
              2 m Temperatur
            </span>
            {activeTime && (
              <span className="rounded-md bg-background/85 px-2 py-1 font-mono text-[11px] text-foreground">
                {fmtTime(activeTime)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-[10px] text-muted-foreground">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  q.isFetching ? "bg-amber-500" : "bg-emerald-500",
                )}
              />
              {updated ? `Aktualisiert ${updated}` : q.isLoading ? "ladet" : "—"}
            </span>
          </div>
        </div>

        {pick && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-[11px] backdrop-blur md:right-6">
            <div className="font-mono">
              {pick.lat.toFixed(2)}°N {pick.lon.toFixed(2)}°E
            </div>
            <div className="font-semibold">
              {pickVal != null && !Number.isNaN(pickVal)
                ? `${pickVal.toFixed(1)} °C`
                : "keine Daten"}
            </div>
          </div>
        )}

        <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2 md:inset-x-6">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2 shadow-elegant backdrop-blur-xl">
            <button
              onClick={() => setStep(0)}
              className="rounded-md border border-border px-2 py-1 font-mono text-[11px] text-foreground hover:bg-muted"
            >
              Jetzt
            </button>
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              className="w-full accent-primary"
              disabled={!field}
            />
            <span className="w-14 text-right font-mono text-[11px] text-foreground">
              {step === 0 ? "Jetzt" : `+${step} h`}
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2 shadow-elegant backdrop-blur-xl">
            <span className="text-[11px] text-muted-foreground">Deckkraft</span>
            <input
              type="range"
              min={0.3}
              max={0.9}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-32 accent-primary"
            />
            <span className="ml-auto hidden text-[10px] text-muted-foreground md:block">
              Open-Meteo best_match · 0,75°-Raster (Übersicht), interpoliert
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-28 right-3 z-10 rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-[10px] backdrop-blur md:right-6">
          <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
            2 m Temperatur (°C)
          </div>
          <div className="h-2.5 w-44 rounded-sm" style={{ background: gradientCss() }} />
          <div className="mt-0.5 flex w-44 justify-between font-mono text-[9px] text-muted-foreground">
            <span>-20</span>
            <span>0</span>
            <span>15</span>
            <span>30</span>
            <span>42</span>
          </div>
        </div>

        {q.isError && (
          <div className="absolute inset-x-0 top-20 z-10 mx-auto w-fit rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground">
            Temperaturfeld konnte nicht geladen werden.
          </div>
        )}
      </div>
    </div>
  );
}