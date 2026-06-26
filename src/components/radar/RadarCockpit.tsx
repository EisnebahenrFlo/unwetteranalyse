import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Radar,
  Globe2,
  MapPin,
  Activity,
  Target,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { RadarMap, type RadarMapHandle } from "./RadarMap";
import {
  WMS_LAYERS,
  fetchWmsTimeline,
  wmsTileUrl,
  type WmsLayerKey,
} from "@/lib/weather/sources/dwd-wms";
import { assessTimeline, type Confidence } from "@/lib/weather/analysis/radar-cockpit";
import {
  assessSnapshot,
  modelVsObservation,
  triggerLight,
} from "@/lib/weather/analysis/cockpit-diagnostics";
import { forecastQuery } from "@/lib/weather/queries";
import { useLiveNow } from "@/hooks/use-live-now";
import { liveHourly } from "@/lib/weather/live";
import {
  ModelObsCard,
  SourceConfidenceGrid,
  TriggerLightCard,
  type SourceConfidence,
} from "./CockpitDiagnostics";
import { useStormTracking } from "@/lib/weather/storm/use-storm-tracking";
import { StormPanel } from "@/components/storm/StormPanel";
import { StormAlertBanner } from "@/components/storm/StormAlertBanner";
import { useHazards } from "@/lib/weather/hazards/use-hazards";
import { HazardAlertBanner } from "@/components/hazards/HazardAlertBanner";
import { DEFAULT_HAZARD_THRESHOLDS, type HazardLevel } from "@/lib/weather/hazards/types";
import { useSavedLocations } from "@/hooks/use-saved-locations";
import { useSettings } from "@/hooks/use-settings";
import { DEFAULT_STORM_THRESHOLDS } from "@/lib/weather/storm/types";

type Mode = "focus" | "europe" | "ground";

const MODE_DEFS: Record<
  Mode,
  { label: string; icon: typeof Radar; baseLayer: WmsLayerKey; zoom: number; opacity: number }
> = {
  focus: { label: "Fokus DE", icon: Radar, baseLayer: "ry", zoom: 6.5, opacity: 0.75 },
  europe: { label: "Mitteleuropa", icon: Globe2, baseLayer: "pi", zoom: 5.0, opacity: 0.7 },
  ground: { label: "Bodencheck", icon: MapPin, baseLayer: "ry", zoom: 7.5, opacity: 0.35 },
};

export function RadarCockpit() {
  const point = useActivePoint();
  const now = useLiveNow();
  const mapRef = useRef<RadarMapHandle>(null);

  const [mode, setMode] = useState<Mode>("focus");
  const [showWnNowcast, setShowWnNowcast] = useState(false);
  const [showRings, setShowRings] = useState(true);
  const [scrub, setScrub] = useState<number>(0);
  const [playing, setPlaying] = useState(false);

  const ryQ = useQuery({
    queryKey: ["wms", "ry"],
    queryFn: () => fetchWmsTimeline("ry"),
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });
  const wnQ = useQuery({
    queryKey: ["wms", "wn"],
    queryFn: () => fetchWmsTimeline("wn"),
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
    enabled: showWnNowcast || scrub > 0,
  });
  const piQ = useQuery({
    queryKey: ["wms", "pi"],
    queryFn: () => fetchWmsTimeline("pi"),
    refetchInterval: 10 * 60_000,
    staleTime: 9 * 60_000,
    enabled: mode === "europe",
  });
  const forecastQ = useQuery(forecastQuery(point));

  const baseKey = MODE_DEFS[mode].baseLayer;
  const baseTimeline = baseKey === "pi" ? piQ.data : ryQ.data;
  const ryFrames = ryQ.data?.frames ?? [];
  const wnFrames = wnQ.data?.frames ?? [];

  const activeFrame = useMemo(() => {
    if (mode === "europe") return baseTimeline?.latest ?? null;
    if (scrub === 0) return ryFrames[ryFrames.length - 1] ?? null;
    if (scrub < 0) return ryFrames[Math.max(0, ryFrames.length - 1 + scrub)] ?? null;
    return wnFrames[Math.min(wnFrames.length - 1, scrub - 1)] ?? null;
  }, [mode, scrub, baseTimeline, ryFrames, wnFrames]);

  const activeLayer: WmsLayerKey = mode === "europe" ? "pi" : scrub > 0 ? "wn" : "ry";

  useEffect(() => {
    const def = MODE_DEFS[mode];
    mapRef.current?.flyTo(point.lon, point.lat, def.zoom);
    setScrub(0);
  }, [mode, point.lat, point.lon]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (mode === "europe") {
      m.setFrameStack("radar-ry", [], null, MODE_DEFS[mode].opacity);
      m.setFrameStack("radar-wn", [], null, MODE_DEFS[mode].opacity);
      if (activeFrame)
        m.setRasterTiles("radar-pi", wmsTileUrl("pi", activeFrame), MODE_DEFS[mode].opacity);
      else m.setRasterTiles("radar-pi", null);
      return;
    }
    m.setRasterTiles("radar-pi", null);
    const ryEntries = ryFrames.map((t) => ({ time: t, url: wmsTileUrl("ry", t) }));
    const wnEntries = (showWnNowcast ? wnFrames : []).map((t) => ({
      time: t,
      url: wmsTileUrl("wn", t),
    }));
    const activeRy = activeLayer === "ry" ? activeFrame : null;
    const activeWn = activeLayer === "wn" ? activeFrame : null;
    m.setFrameStack("radar-ry", ryEntries, activeRy, MODE_DEFS[mode].opacity);
    m.setFrameStack("radar-wn", wnEntries, activeWn, MODE_DEFS[mode].opacity);
  }, [mode, ryFrames, wnFrames, showWnNowcast, activeFrame, activeLayer]);

  useEffect(() => {
    mapRef.current?.setFocusRings(showRings ? { lat: point.lat, lon: point.lon } : null);
  }, [showRings, point.lat, point.lon]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setScrub((s) => {
        const minStep = -Math.max(0, ryFrames.length - 1);
        const maxStep = showWnNowcast ? wnFrames.length : 0;
        const next = s + 1;
        return next > maxStep ? minStep : next;
      });
    }, 350);
    return () => window.clearInterval(id);
  }, [playing, ryFrames.length, wnFrames.length, showWnNowcast]);

  const minScrub = -Math.max(0, ryFrames.length - 1);
  const maxScrub = wnFrames.length;

  const hourlyLive = useMemo(
    () => (forecastQ.data ? liveHourly(forecastQ.data.hourly, now) : []),
    [forecastQ.data, now],
  );
  const nowHour = hourlyLive[0];
  const ryLagMs = ryQ.data?.lagMs ?? null;
  const ryFreshAndWet =
    ryLagMs != null && ryLagMs <= 15 * 60_000 && (nowHour?.precipitationMm ?? 0) >= 0.3;

  /* ---------- Stormtracking ---------- */
  const favorites = useSavedLocations();
  const [settings] = useSettings();
  const stormEnabled = settings.storm.enabled;
  const stormThresholds = useMemo(
    () => ({
      ...DEFAULT_STORM_THRESHOLDS,
      alertEtaMin: settings.storm.alertEtaMin,
      alertLevel: settings.storm.alertLevel,
    }),
    [settings.storm.alertEtaMin, settings.storm.alertLevel],
  );
  const storm = useStormTracking({
    activePoint: { lat: point.lat, lon: point.lon },
    thresholds: stormThresholds,
  });

  const radarTopDbz = useMemo(
    () => storm.cells.reduce((m, c) => Math.max(m, c.topDbz), 0) || null,
    [storm.cells],
  );

  const trig = triggerLight({ nowHour, radarTopDbz, ryLagMs });
  const modelObs = modelVsObservation({ nowHour, radarTopDbz, ryFreshAndWet });
  const snapHealth = assessSnapshot({
    snapshotStatus: storm.snapshotStatus,
    cellCount: storm.cells.length,
    lastFrameTime: storm.lastFrameTime,
    lastRun: storm.lastRun,
  });

  useEffect(() => {
    mapRef.current?.setStormCells(settings.storm.showLayer ? storm.cells : []);
  }, [storm.cells, settings.storm.showLayer]);

  useEffect(() => {
    mapRef.current?.setHailCores(settings.storm.showHailCores ? storm.cells : []);
  }, [storm.cells, settings.storm.showHailCores]);

  useEffect(() => {
    const targets = [
      { name: point.name, lat: point.lat, lon: point.lon },
      ...favorites
        .filter((f) => f.lat !== point.lat || f.lon !== point.lon)
        .map((f) => ({ name: f.name, lat: f.lat, lon: f.lon })),
    ];
    mapRef.current?.setNamedTargets(targets);
  }, [point.lat, point.lon, point.name, favorites]);

  /* ---------- Hazards ---------- */
  const hazardThresholds = useMemo(
    () => ({
      ...DEFAULT_HAZARD_THRESHOLDS,
      minLevel: settings.hazards.minLevel as HazardLevel,
      alertEtaMin: settings.hazards.alertEtaMin,
      cooldownMin: settings.hazards.cooldownMin,
      hitKm: settings.hazards.hitKm,
      enableHail: settings.hazards.enableHail,
      enableFlood: settings.hazards.enableFlood,
    }),
    [
      settings.hazards.minLevel,
      settings.hazards.alertEtaMin,
      settings.hazards.cooldownMin,
      settings.hazards.hitKm,
      settings.hazards.enableHail,
      settings.hazards.enableFlood,
    ],
  );
  const hazards = useHazards({
    cells: storm.cells,
    favorites,
    thresholds: hazardThresholds,
    enabled: stormEnabled && settings.hazards.enabled,
  });

  const sourceConfidence: SourceConfidence[] = [
    {
      key: "ry",
      label: "Radar RY",
      state: ryQ.data?.latest ? (ryQ.data.gaps > 0 ? "limited" : "good") : "missing",
      detail: ryQ.data?.latest
        ? `${Math.round((ryQ.data.lagMs ?? 0) / 60000)} min alt${ryQ.data.gaps > 0 ? ` · ${ryQ.data.gaps} Lücken` : ""}`
        : "keine Frames",
    },
    {
      key: "wn",
      label: "Nowcast WN",
      state: wnQ.data?.latest ? "good" : showWnNowcast ? "limited" : "missing",
      detail: wnQ.data?.latest
        ? `${wnQ.data.frames.length} Frames`
        : showWnNowcast
          ? "lädt"
          : "Layer aus",
    },
    {
      key: "storm",
      label: snapHealth.label,
      state: snapHealth.status === "ok" ? "good" : snapHealth.status,
      detail: snapHealth.detail,
    },
    {
      key: "model",
      label: "Modell",
      state: forecastQ.data ? "good" : forecastQ.isLoading ? "limited" : "missing",
      detail: forecastQ.data
        ? "Open-Meteo Forecast"
        : forecastQ.isLoading
          ? "lädt"
          : "nicht erreichbar",
    },
  ];

  return (
    <div className="relative -mx-3 md:-mx-6">
      {/* Vollflächige Karte als Bühne; Panels schweben als Glas-Karten darüber. */}
      <div className="relative h-[calc(100vh-12rem)] min-h-[520px] w-full overflow-hidden bg-muted md:h-[calc(100vh-10rem)]">
        <RadarMap ref={mapRef} initialCenter={point} initialZoom={MODE_DEFS[mode].zoom} />

        {/* Top-Banner für Alerts (über der Karte, kompakt) */}
        {(storm.alerts.length > 0 || hazards.alerts.length > 0) && (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-col gap-2 md:inset-x-6">
            <div className="pointer-events-auto">
              {storm.alerts.length > 0 && <StormAlertBanner alerts={storm.alerts} />}
            </div>
            <div className="pointer-events-auto">
              {hazards.alerts.length > 0 && <HazardAlertBanner alerts={hazards.alerts} />}
            </div>
          </div>
        )}

        {/* TopBar als schwebende Glas-Karte */}
        <div className="pointer-events-auto absolute left-3 right-3 top-3 z-10 md:left-6 md:right-auto md:max-w-[640px]">
          <TopBar
            mode={mode}
            onModeChange={setMode}
            ry={
              ryQ.data
                ? assessTimeline("RY", ryQ.data, WMS_LAYERS.ry.stepMinutes)
                : { label: "RY", confidence: "missing", detail: "lädt…" }
            }
            wn={wnQ.data ? assessTimeline("WN", wnQ.data, WMS_LAYERS.wn.stepMinutes) : null}
            pi={piQ.data ? assessTimeline("PI", piQ.data, WMS_LAYERS.pi.stepMinutes) : null}
          />
        </div>

        <Legend layer={activeLayer} />
        <FrameBadge frame={activeFrame} scrub={scrub} />

        {/* Bedienleiste unten: Scrubber + Layer */}
        <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2 md:inset-x-6 md:right-[360px]">
          <TimeScrubber
            value={scrub}
            min={minScrub}
            max={maxScrub}
            stepMinutes={5}
            playing={playing}
            onChange={(v) => {
              setPlaying(false);
              setScrub(v);
              if (v > 0) setShowWnNowcast(true);
            }}
            onPlay={() => setPlaying((p) => !p)}
            onJumpNow={() => {
              setPlaying(false);
              setScrub(0);
            }}
            disabled={ryFrames.length === 0}
          />
          <LayerToolbar
            showWn={showWnNowcast}
            onToggleWn={() => {
              setShowWnNowcast((v) => {
                if (v) setScrub(0);
                return !v;
              });
            }}
            showRings={showRings}
            onToggleRings={() => setShowRings((v) => !v)}
          />
        </div>

        {/* Aside als schwebende Glas-Spalte rechts; auf Mobile unter der Karte */}
        <aside className="pointer-events-auto absolute right-3 top-20 z-10 hidden max-h-[calc(100%-9rem)] w-[340px] flex-col gap-3 overflow-y-auto pb-32 md:right-6 lg:flex">
          <StormPanel
            cells={storm.cells}
            alerts={storm.alerts}
            activeEta={storm.activeEta}
            snapshotOk={storm.snapshotStatus === "ok"}
            hazardReports={hazards.reports}
          />
          <TriggerLightCard t={trig} />
          <ModelObsCard c={modelObs} />
          <SourceConfidenceGrid items={sourceConfidence} />
        </aside>
      </div>

      {/* Mobile / Tablet: Panels gestapelt unter der Karte */}
      <div className="flex flex-col gap-3 px-3 py-3 md:px-6 lg:hidden">
        <StormPanel
          cells={storm.cells}
          alerts={storm.alerts}
          activeEta={storm.activeEta}
          snapshotOk={storm.snapshotStatus === "ok"}
          hazardReports={hazards.reports}
        />
        <TriggerLightCard t={trig} />
        <ModelObsCard c={modelObs} />
        <SourceConfidenceGrid items={sourceConfidence} />
      </div>
    </div>
  );
}

function TopBar({
  mode,
  onModeChange,
  ry,
  wn,
  pi,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  ry: { label: string; confidence: Confidence; detail: string };
  wn: { label: string; confidence: Confidence; detail: string } | null;
  pi: { label: string; confidence: Confidence; detail: string } | null;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 rounded-xl border border-border/60 bg-card/70 p-2 shadow-elegant backdrop-blur-xl md:grid-cols-[auto_1fr_auto]">
      <div className="flex gap-1">
        {(Object.keys(MODE_DEFS) as Mode[]).map((m) => {
          const Icon = MODE_DEFS[m].icon;
          return (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {MODE_DEFS[m].label}
            </button>
          );
        })}
      </div>
      <div className="hidden text-[11px] text-muted-foreground md:block">
        Quelle: DWD GeoServer · Stormtrack aus RY-Niederschlag (DE, dBZ via Z-R)
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HealthPill h={ry} />
        {wn && <HealthPill h={wn} />}
        {pi && <HealthPill h={pi} />}
      </div>
    </div>
  );
}

function HealthPill({ h }: { h: { label: string; confidence: Confidence; detail: string } }) {
  const tone =
    h.confidence === "ok"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : h.confidence === "delayed"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : h.confidence === "degraded"
          ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono",
        tone,
      )}
    >
      <span className="font-semibold">{h.label}</span>
      <span className="opacity-80">{h.detail}</span>
    </span>
  );
}

function FrameBadge({ frame, scrub }: { frame: string | null; scrub: number }) {
  const tag = scrub === 0 ? "Jetzt" : scrub < 0 ? "Verlauf" : "Nowcast";
  const tone =
    scrub === 0
      ? "bg-emerald-500/90 text-white"
      : scrub < 0
        ? "bg-slate-500/90 text-white"
        : "bg-sky-500/90 text-white";
  return (
    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
      <span
        className={cn(
          "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
          tone,
        )}
      >
        {tag}
      </span>
      {frame && (
        <span className="rounded-md bg-background/85 px-2 py-1 font-mono text-[11px] text-foreground backdrop-blur">
          {new Date(frame).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

function Legend({ layer }: { layer: WmsLayerKey }) {
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-[10px] backdrop-blur">
      <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
        {WMS_LAYERS[layer].label} · Niederschlag (RY, mm/5min)
      </div>
      <div className="flex items-center gap-1">
        {["#fbff5c", "#a0d626", "#00d6d8", "#0702fc", "#da28c6", "#e70d0c", "#880e0d"].map((c) => (
          <span key={c} className="h-2.5 w-5 rounded-sm" style={{ backgroundColor: c }} />
        ))}
      </div>
    </div>
  );
}

function TimeScrubber({
  value,
  min,
  max,
  stepMinutes,
  playing,
  onChange,
  onPlay,
  onJumpNow,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  stepMinutes: number;
  playing: boolean;
  onChange: (v: number) => void;
  onPlay: () => void;
  onJumpNow: () => void;
  disabled?: boolean;
}) {
  const offsetMin = value * stepMinutes;
  const label = offsetMin === 0 ? "Jetzt" : `${offsetMin > 0 ? "+" : ""}${offsetMin} min`;
  return (
    <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-2 py-2 shadow-elegant backdrop-blur-xl">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled}
      >
        <SkipBack className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant={playing ? "default" : "outline"}
        className="h-8 w-8"
        onClick={onPlay}
        disabled={disabled}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full accent-primary"
        />
        <div className="pointer-events-none flex justify-between px-1 pt-0.5 font-mono text-[9px] text-muted-foreground">
          <span>{min * stepMinutes} min</span>
          <span>Jetzt</span>
          <span>+{max * stepMinutes} min</span>
        </div>
      </div>
      <button
        onClick={onJumpNow}
        className="rounded-md border border-border px-2 py-1 font-mono text-[11px] text-foreground hover:bg-muted"
        disabled={disabled}
      >
        {label}
      </button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled}
      >
        <SkipForward className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function LayerToolbar({
  showWn,
  onToggleWn,
  showRings,
  onToggleRings,
}: {
  showWn: boolean;
  onToggleWn: () => void;
  showRings: boolean;
  onToggleRings: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/70 p-2 shadow-elegant backdrop-blur-xl">
      <LayerChip active={true} label="RY" hint="Beobachtung 5 min" />
      <LayerChip active={showWn} onClick={onToggleWn} label="WN" hint="Nowcast +2 h" />
      <LayerChip
        active={showRings}
        onClick={onToggleRings}
        label="Ringe"
        icon={<Target className="h-3 w-3" />}
        hint="10 · 25 · 50 · 100 km"
      />
      <div className="ml-auto inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">
        <Activity className="h-3 w-3" /> Stormtrack 60-s-Polling
      </div>
    </div>
  );
}

function LayerChip({
  active,
  onClick,
  label,
  hint,
  icon,
}: {
  active: boolean;
  onClick?: () => void;
  label: string;
  hint: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
        !onClick && "cursor-default",
      )}
      title={hint}
    >
      {icon}
      <span className="font-semibold">{label}</span>
      <span className="hidden text-[10px] opacity-80 md:inline">{hint}</span>
    </button>
  );
}