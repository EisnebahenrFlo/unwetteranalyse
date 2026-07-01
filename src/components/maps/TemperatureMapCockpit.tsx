import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Info,
  Lock,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  X,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ForecastFieldMap, type ForecastFieldMapHandle } from "./ForecastFieldMap";
import { fetchTemperatureField } from "@/lib/weather/maps/temperature-field";
import { sampleField, TEMP_STOPS } from "@/lib/weather/maps/field-render";
import { forecastQuery } from "@/lib/weather/queries";
import type { GeoPoint } from "@/lib/weather/types";
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
  const [legendOpen, setLegendOpen] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

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

  const pickPoint: GeoPoint | null = useMemo(
    () => (pick ? { lat: pick.lat, lon: pick.lon, name: "Gewählter Punkt" } : null),
    [pick],
  );
  const fq = useQuery({
    ...forecastQuery(pickPoint ?? { lat: 0, lon: 0, name: "-" }),
    enabled: !!pickPoint,
  });

  const activeTime = field?.times[hourIdx];
  const updated = field
    ? new Date(field.fetchedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : null;
  const freshDot = q.isFetching ? "bg-muted-foreground" : "bg-primary";

  return (
    <div className="-mx-3 md:-mx-6">
      <div className="flex h-[calc(100vh-12rem)] min-h-[520px] w-full flex-col overflow-hidden bg-background md:h-[calc(100vh-10rem)]">
        {/* TOP-STREIFEN */}
        <div className="flex flex-col gap-2 border-b border-border bg-card px-3 py-2 md:flex-row md:items-center md:gap-3 md:px-6">
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
                  {!p.available && <Lock className="h-3 w-3" />}
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1 md:ml-3">
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
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
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

        {/* KARTE */}
        <div className="relative min-h-0 flex-1 bg-muted">
          <ForecastFieldMap
            ref={mapRef}
            initialCenter={{ lat: initialDomain.lat, lon: initialDomain.lon }}
            initialZoom={initialDomain.zoom}
            onPick={(lat, lon) => setPick({ lat, lon })}
            showLabels={showLabels}
          />

          {/* Kompakte, einklappbare Legende */}
          <div className="pointer-events-auto absolute bottom-3 right-3 z-10 rounded-md border border-border/60 bg-card/85 px-2 py-1.5 text-[10px] shadow-elegant backdrop-blur-xl">
            <button
              onClick={() => setLegendOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 font-display text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              aria-expanded={legendOpen}
            >
              {legendOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
              Legende · 2 m T (°C)
            </button>
            {legendOpen && (
              <div className="mt-1">
                <div className="h-2.5 w-40 rounded-sm" style={{ background: gradientCss() }} />
                <div className="mt-0.5 flex w-40 justify-between font-mono text-[9px] tabular-nums text-muted-foreground">
                  <span>-20</span>
                  <span>0</span>
                  <span>15</span>
                  <span>30</span>
                  <span>42</span>
                </div>
              </div>
            )}
          </div>

          {q.isError && (
            <div className="absolute inset-x-0 top-3 z-10 mx-auto w-fit rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground">
              Temperaturfeld konnte nicht geladen werden.
            </div>
          )}

          {pick && (
            <PointForecastPanel
              lat={pick.lat}
              lon={pick.lon}
              query={fq}
              fieldReadout={
                pickVal != null && !Number.isNaN(pickVal) && activeTime
                  ? `Feld: ${pickVal.toFixed(1)} °C @ ${fmtTime(activeTime)}`
                  : null
              }
              onClose={() => setPick(null)}
            />
          )}
        </div>

        {/* BOTTOM-STREIFEN */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-3 py-2 md:flex-nowrap md:gap-3 md:px-6">
          {/* Hinweis statt Pick-Readout (Panel übernimmt die Werte) */}
          <div className="hidden min-w-[180px] font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:block">
            {pick ? "Punkt-Forecast oben-links" : "Karte tippen für Punkt-Forecast"}
          </div>

          {/* Scrubber */}
          <div className="ml-auto flex min-w-0 flex-1 items-center gap-1.5 md:gap-2">
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
              className="h-11 min-w-0 flex-1 accent-primary md:h-6"
              disabled={!field}
              aria-label="Vorhersagezeit"
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
              {step === 0 ? "Jetzt" : `+${step} h`}
            </span>
          </div>

          {/* Deckkraft-Popover + Quelle-Info */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowLabels((v) => !v)}
              aria-pressed={showLabels}
              className={cn(
                "inline-flex h-11 items-center rounded-md border px-2.5 font-display text-[11px] font-semibold uppercase tracking-wider transition-colors md:h-8",
                showLabels
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              Zahlen
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-11 w-11 md:h-8 md:w-8"
                  aria-label="Deckkraft"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-56">
                <div className="flex flex-col gap-2">
                  <span className="font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    Deckkraft Temperaturfeld
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.3}
                      max={0.9}
                      step={0.05}
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="h-6 flex-1 accent-primary"
                      aria-label="Deckkraft Temperaturfeld"
                    />
                    <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {Math.round(opacity * 100)}%
                    </span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Datenquelle"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  Open-Meteo best_match · 0,75°-Raster (Übersicht), interpoliert
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}