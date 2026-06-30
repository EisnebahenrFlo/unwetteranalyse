import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play, SkipBack, SkipForward } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ForecastFieldMap, type ForecastFieldMapHandle } from "./ForecastFieldMap";
import { fetchTemperatureField } from "@/lib/weather/maps/temperature-field";
import { sampleField, TEMP_STOPS } from "@/lib/weather/maps/field-render";
import { cn } from "@/lib/utils";

type ParamKey = "t2m" | "gust" | "precip";
type DomainKey = "dach" | "italy" | "alps";

interface ParamDef {
  key: ParamKey;
  label: string;
  available: boolean;
}
const PARAMS: ParamDef[] = [
  { key: "t2m", label: "2 m Temperatur", available: true },
  { key: "gust", label: "Windböen", available: false },
  { key: "precip", label: "Niederschlag", available: false },
];

interface DomainDef {
  key: DomainKey;
  label: string;
  lat: number;
  lon: number;
  zoom: number;
}
const DOMAINS: DomainDef[] = [
  { key: "dach", label: "DACH", lat: 47.8, lon: 11.5, zoom: 5.2 },
  { key: "italy", label: "Italien", lat: 42.5, lon: 12.5, zoom: 5.0 },
  { key: "alps", label: "Alpen", lat: 46.8, lon: 10.5, zoom: 6.2 },
];
const DEFAULT_DOMAIN: DomainKey = "dach";

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
  const [param, setParam] = useState<ParamKey>("t2m");
  const [domain, setDomain] = useState<DomainKey>(DEFAULT_DOMAIN);
  const [playing, setPlaying] = useState(false);

  const q = useQuery({
    queryKey: ["temp-field"],
    queryFn: ({ signal }) => fetchTemperatureField(signal),
    refetchInterval: 10 * 60_000,
    staleTime: 8 * 60_000,
  });

  const field = q.data;
  const initialDomain = DOMAINS.find((d) => d.key === DEFAULT_DOMAIN)!;
  const startIdx = useMemo(() => {
    if (!field || field.times.length === 0) return 0;
    const t0 = new Date(field.times[0]).getTime();
    return Math.max(0, Math.round((Date.now() - t0) / 3_600_000));
  }, [field]);
  const hourIdx = useMemo(() => {
    if (!field) return 0;
    return Math.min(field.times.length - 1, startIdx + step);
  }, [field, startIdx, step]);
  const maxStep = useMemo(() => {
    if (!field) return 24;
    return Math.max(0, Math.min(24, field.times.length - 1 - startIdx));
  }, [field, startIdx]);

  useEffect(() => {
    if (field) mapRef.current?.update(field, hourIdx, opacity);
  }, [field, hourIdx, opacity]);

  // Domain-Preset: nur Kamera-Move, keine Datenänderung.
  function selectDomain(key: DomainKey) {
    const d = DOMAINS.find((x) => x.key === key);
    if (!d) return;
    setDomain(key);
    mapRef.current?.flyTo(d.lon, d.lat, d.zoom);
  }

  // Play-Loop über bestehende Vorhersagestunden, am Ende zurück auf 0.
  useEffect(() => {
    if (!playing || !field) return;
    const id = window.setInterval(() => {
      setStep((s) => (s >= maxStep ? 0 : s + 1));
    }, 350);
    return () => window.clearInterval(id);
  }, [playing, field, maxStep]);

  const pickVal = useMemo(() => {
    if (!field || !pick) return null;
    return sampleField(field, hourIdx, pick.lat, pick.lon);
  }, [field, pick, hourIdx]);

  const activeTime = field?.times[hourIdx];
  const updated = field
    ? new Date(field.fetchedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : null;
  const freshDot = q.isFetching ? "bg-muted-foreground" : "bg-primary";

  return (
    <div className="relative -mx-3 md:-mx-6">
      <div className="relative h-[calc(100vh-12rem)] min-h-[520px] w-full overflow-hidden bg-muted md:h-[calc(100vh-10rem)]">
        <ForecastFieldMap
          ref={mapRef}
          initialCenter={{ lat: initialDomain.lat, lon: initialDomain.lon }}
          initialZoom={initialDomain.zoom}
          onPick={(lat, lon) => setPick({ lat, lon })}
        />

        {/* Pivotal-Header: Parameter · Zeit-Label · Frische */}
        <div className="pointer-events-auto absolute left-3 right-3 top-3 z-10 md:left-6 md:right-auto md:max-w-[720px]">
          <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/70 p-2 shadow-elegant backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-1.5">
              {PARAMS.map((p) => {
                const active = p.key === param && p.available;
                return (
                  <button
                    key={p.key}
                    onClick={() => p.available && setParam(p.key)}
                    disabled={!p.available}
                    title={p.available ? p.label : `${p.label} — bald verfügbar`}
                    aria-disabled={!p.available}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-wider transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : p.available
                          ? "border-border text-muted-foreground hover:bg-muted"
                          : "cursor-not-allowed border-dashed border-border/60 text-muted-foreground/60",
                    )}
                  >
                    {p.label}
                    {!p.available && (
                      <span className="rounded-sm bg-muted px-1 font-mono text-[9px] tracking-normal text-muted-foreground">
                        bald
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-2">
                {activeTime && (
                  <span className="rounded-md bg-muted/60 px-2 py-1 font-mono text-[11px] tabular-nums text-foreground">
                    {fmtTime(activeTime)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                  <span className={cn("h-1.5 w-1.5 rounded-full", freshDot)} aria-hidden />
                  {updated
                    ? `Stand ${updated}`
                    : q.isLoading
                      ? "lädt …"
                      : q.isError
                        ? "offline"
                        : "–"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                Domain
              </span>
              {DOMAINS.map((d) => {
                const active = d.key === domain;
                return (
                  <button
                    key={d.key}
                    onClick={() => selectDomain(d.key)}
                    className={cn(
                      "rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {pick && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md border border-border/60 bg-card/70 px-2.5 py-1.5 text-[11px] shadow-elegant backdrop-blur-xl md:right-6">
            <div className="font-mono tabular-nums text-muted-foreground">
              {pick.lat.toFixed(2)}°N {pick.lon.toFixed(2)}°E
            </div>
            <div className="font-display text-sm font-semibold tabular-nums text-foreground">
              {pickVal != null && !Number.isNaN(pickVal)
                ? `${pickVal.toFixed(1)} °C`
                : "keine Daten"}
            </div>
          </div>
        )}

        <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2 md:inset-x-6">
          <div className="grid grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-2 py-2 shadow-elegant backdrop-blur-xl">
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11 md:h-8 md:w-8"
              onClick={() => {
                setPlaying(false);
                setStep((s) => Math.max(0, s - 1));
              }}
              disabled={!field || step <= 0}
              aria-label="Schritt zurück"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant={playing ? "default" : "outline"}
              className="h-11 w-11 md:h-8 md:w-8"
              onClick={() => setPlaying((p) => !p)}
              disabled={!field || maxStep === 0}
              aria-label={playing ? "Pause" : "Abspielen"}
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <button
              onClick={() => {
                setPlaying(false);
                setStep(0);
              }}
              className="rounded-md border border-border px-2 py-1 font-mono text-[11px] tabular-nums text-foreground hover:bg-muted"
            >
              Jetzt
            </button>
            <input
              type="range"
              min={0}
              max={maxStep}
              step={1}
              value={Math.min(step, maxStep)}
              onChange={(e) => {
                setPlaying(false);
                setStep(Number(e.target.value));
              }}
              className="h-11 w-full accent-primary md:h-6"
              disabled={!field}
              aria-label="Vorhersagezeit"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11 md:h-8 md:w-8"
              onClick={() => {
                setPlaying(false);
                setStep((s) => Math.min(maxStep, s + 1));
              }}
              disabled={!field || step >= maxStep}
              aria-label="Schritt vor"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
            <span className="col-span-full -mt-1 text-right font-mono text-[10px] tabular-nums text-muted-foreground md:col-span-1 md:mt-0 md:w-14">
              {step === 0 ? "Jetzt" : `+${step} h`}
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2 shadow-elegant backdrop-blur-xl">
            <span className="font-display text-[10px] uppercase tracking-wider text-muted-foreground">
              Deckkraft
            </span>
            <input
              type="range"
              min={0.3}
              max={0.9}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="h-11 w-32 accent-primary md:h-6"
              aria-label="Deckkraft Temperaturfeld"
            />
            <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground md:block">
              Open-Meteo best_match · 0,75°-Raster (Übersicht), interpoliert
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-28 right-3 z-10 rounded-md border border-border/60 bg-card/70 px-2.5 py-1.5 text-[10px] shadow-elegant backdrop-blur-xl md:right-6">
          <div className="mb-1 font-display text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            2 m Temperatur (°C)
          </div>
          <div className="h-2.5 w-44 rounded-sm" style={{ background: gradientCss() }} />
          <div className="mt-0.5 flex w-44 justify-between font-mono text-[9px] tabular-nums text-muted-foreground">
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