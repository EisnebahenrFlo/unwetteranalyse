import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play, SkipBack, SkipForward, Zap, Radar, Globe2, MapPin, Activity, ShieldAlert, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { RadarMap, type RadarMapHandle } from "./RadarMap";
import { WMS_LAYERS, fetchWmsTimeline, wmsTileUrl, type WmsLayerKey } from "@/lib/weather/sources/dwd-wms";
import { useLightningStream } from "@/lib/weather/sources/blitzortung";
import { analyseLightning, assessTimeline, type Confidence } from "@/lib/weather/analysis/radar-cockpit";
import { forecastQuery } from "@/lib/weather/queries";
import { useLiveNow } from "@/hooks/use-live-now";
import { liveHourly } from "@/lib/weather/live";
import {
  triggerLight, blitzVsRadar, modelVsObservation, cellTracking,
} from "@/lib/weather/analysis/cockpit-diagnostics";
import {
  TriggerLightCard, BlitzRadarCard, ModelObsCard, CellTrackCard,
  SourceConfidenceGrid, type SourceConfidence,
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

const MODE_DEFS: Record<Mode, { label: string; icon: typeof Radar; baseLayer: WmsLayerKey; zoom: number; opacity: number }> = {
  focus:  { label: "Fokus DE",       icon: Radar,  baseLayer: "ry", zoom: 6.5, opacity: 0.75 },
  europe: { label: "Mitteleuropa",   icon: Globe2, baseLayer: "pi", zoom: 5.0, opacity: 0.7 },
  ground: { label: "Bodencheck",     icon: MapPin, baseLayer: "ry", zoom: 7.5, opacity: 0.35 },
};

export function RadarCockpit() {
  const point = useActivePoint();
  const now = useLiveNow();
  const mapRef = useRef<RadarMapHandle>(null);

  const [mode, setMode] = useState<Mode>("focus");
  const [showLightning, setShowLightning] = useState(true);
  const [showWnNowcast, setShowWnNowcast] = useState(false);
  const [showQy, setShowQy] = useState(false);
  const [showRings, setShowRings] = useState(true);
  const [scrub, setScrub] = useState<number>(0); // negative = RY past, positive = WN future, in step-units
  const [playing, setPlaying] = useState(false);
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);

  const ryQ = useQuery({ queryKey: ["wms", "ry"], queryFn: () => fetchWmsTimeline("ry"), refetchInterval: 5 * 60_000, staleTime: 4 * 60_000 });
  const wnQ = useQuery({ queryKey: ["wms", "wn"], queryFn: () => fetchWmsTimeline("wn"), refetchInterval: 5 * 60_000, staleTime: 4 * 60_000, enabled: showWnNowcast || scrub > 0 });
  const piQ = useQuery({ queryKey: ["wms", "pi"], queryFn: () => fetchWmsTimeline("pi"), refetchInterval: 10 * 60_000, staleTime: 9 * 60_000, enabled: mode === "europe" });
  const qyQ = useQuery({ queryKey: ["wms", "qy"], queryFn: () => fetchWmsTimeline("qy"), refetchInterval: 5 * 60_000, staleTime: 4 * 60_000, enabled: showQy });
  const forecastQ = useQuery(forecastQuery(point));

  const lightning = useLightningStream({ enabled: showLightning, bbox: bbox ?? undefined });

  // Aktives Frame bestimmen
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

  // Mode → Karte rezentrieren
  useEffect(() => {
    const def = MODE_DEFS[mode];
    mapRef.current?.flyTo(point.lon, point.lat, def.zoom);
    setScrub(0);
  }, [mode, point.lat, point.lon]);

  // Frame-Stacks: alle relevanten Frames bleiben gemountet → kein Refetch beim Scrubben/Playback.
  // Wechsel passieren über raster-opacity (Crossfade ~180 ms) statt Source/Layer-Recreate.
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    if (mode === "europe") {
      m.setFrameStack("radar-ry", [], null, MODE_DEFS[mode].opacity);
      m.setFrameStack("radar-wn", [], null, MODE_DEFS[mode].opacity);
      if (activeFrame) m.setRasterTiles("radar-pi", wmsTileUrl("pi", activeFrame), MODE_DEFS[mode].opacity);
      else m.setRasterTiles("radar-pi", null);
      return;
    }
    m.setRasterTiles("radar-pi", null);
    const ryEntries = ryFrames.map((t) => ({ time: t, url: wmsTileUrl("ry", t) }));
    const wnEntries = (showWnNowcast ? wnFrames : []).map((t) => ({ time: t, url: wmsTileUrl("wn", t) }));
    const activeRy = activeLayer === "ry" ? activeFrame : null;
    const activeWn = activeLayer === "wn" ? activeFrame : null;
    m.setFrameStack("radar-ry", ryEntries, activeRy, MODE_DEFS[mode].opacity);
    m.setFrameStack("radar-wn", wnEntries, activeWn, MODE_DEFS[mode].opacity);
  }, [mode, ryFrames, wnFrames, showWnNowcast, activeFrame, activeLayer]);

  // QY-Qualitätslayer als zusätzliches Overlay, an aktuellen Frame gekoppelt.
  useEffect(() => {
    if (!showQy) {
      mapRef.current?.setRasterTiles("qy", null);
      return;
    }
    const qyFrame = qyQ.data?.latest ?? activeFrame ?? null;
    mapRef.current?.setRasterTiles("qy", qyFrame ? wmsTileUrl("qy", qyFrame) : null, 0.55);
  }, [showQy, qyQ.data?.latest, activeFrame]);

  // Fokusringe an aktuellen Ort koppeln.
  useEffect(() => {
    mapRef.current?.setFocusRings(showRings ? { lat: point.lat, lon: point.lon } : null);
  }, [showRings, point.lat, point.lon]);

  // Blitze in die Karte syncen
  useEffect(() => {
    mapRef.current?.setLightning(showLightning ? lightning.strikes : []);
  }, [lightning.strikes, showLightning]);

  // Playback — Frames sind vorgeladen, daher Schritte über reine Opacity-Toggles. ~350 ms wirkt flüssig.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setScrub((s) => {
        const minStep = -(Math.max(0, ryFrames.length - 1));
        const maxStep = showWnNowcast ? wnFrames.length : 0;
        const next = s + 1;
        return next > maxStep ? minStep : next;
      });
    }, 350);
    return () => window.clearInterval(id);
  }, [playing, ryFrames.length, wnFrames.length, showWnNowcast]);

  const minScrub = -(Math.max(0, ryFrames.length - 1));
  const maxScrub = wnFrames.length;

  // Diagnose-Eingaben
  const hourlyLive = useMemo(
    () => (forecastQ.data ? liveHourly(forecastQ.data.hourly, now) : []),
    [forecastQ.data, now],
  );
  const nowHour = hourlyLive[0];
  const lightningInsight = analyseLightning(lightning.strikes, point);
  const lightning15min = useMemo(() => {
    const cutoff = Date.now() - 15 * 60_000;
    return lightning.strikes.filter((s) => s.time >= cutoff).length;
  }, [lightning.strikes]);
  const ryLagMs = ryQ.data?.lagMs ?? null;
  const ryFreshAndWet = ryLagMs != null && ryLagMs <= 15 * 60_000 && (nowHour?.precipitationMm ?? 0) >= 0.3;

  const trig = triggerLight({ nowHour, lightning5min: lightningInsight.last5, ryLagMs });
  const radarLight = blitzVsRadar({ strikes: lightning.strikes, ry: ryQ.data, nowHourPrecipMm: nowHour?.precipitationMm ?? null });
  const modelObs = modelVsObservation({ nowHour, lightning15min, ryFreshAndWet });
  const track = cellTracking({ strikes: lightning.strikes, focus: { lat: point.lat, lon: point.lon } });

  // Stormtrack-Geometrie in die Karte schreiben.
  useEffect(() => {
    mapRef.current?.setCellTrack(track);
  }, [track]);

  /* ---------- Stormtracking (Snapshot vom globalen Background-Service) ---------- */
  const favorites = useSavedLocations();
  const [settings] = useSettings();
  const stormEnabled = settings.storm.enabled;
  const stormThresholds = useMemo(() => ({
    ...DEFAULT_STORM_THRESHOLDS,
    alertEtaMin: settings.storm.alertEtaMin,
    alertLevel: settings.storm.alertLevel,
  }), [settings.storm.alertEtaMin, settings.storm.alertLevel]);
  const storm = useStormTracking({
    activePoint: { lat: point.lat, lon: point.lon },
    thresholds: stormThresholds,
  });

  useEffect(() => {
    mapRef.current?.setStormCells(settings.storm.showLayer ? storm.cells : []);
  }, [storm.cells, settings.storm.showLayer]);

  // Benannte Ziele (aktiver Ort + Favoriten) für ETA-Berechnung in den Zell-Labels.
  useEffect(() => {
    const targets = [
      { name: point.name, lat: point.lat, lon: point.lon },
      ...favorites
        .filter((f) => f.lat !== point.lat || f.lon !== point.lon)
        .map((f) => ({ name: f.name, lat: f.lat, lon: f.lon })),
    ];
    mapRef.current?.setNamedTargets(targets);
  }, [point.lat, point.lon, point.name, favorites]);

  /* ---------- Hazard-Engine (Hagel, Sturzflut, Blitz-Jump) ---------- */
  const hazardThresholds = useMemo(() => ({
    ...DEFAULT_HAZARD_THRESHOLDS,
    minLevel: settings.hazards.minLevel as HazardLevel,
    alertEtaMin: settings.hazards.alertEtaMin,
    cooldownMin: settings.hazards.cooldownMin,
    hitKm: settings.hazards.hitKm,
    enableHail: settings.hazards.enableHail,
    enableFlood: settings.hazards.enableFlood,
    enableLightning: settings.hazards.enableLightning,
  }), [
    settings.hazards.minLevel, settings.hazards.alertEtaMin, settings.hazards.cooldownMin,
    settings.hazards.hitKm, settings.hazards.enableHail, settings.hazards.enableFlood,
    settings.hazards.enableLightning,
  ]);
  const hazards = useHazards({
    cells: storm.cells,
    favorites,
    thresholds: hazardThresholds,
    enabled: stormEnabled && settings.hazards.enabled,
  });

  const sourceConfidence: SourceConfidence[] = [
    {
      key: "ry", label: "Radar RY",
      state: ryQ.data?.latest ? (ryQ.data.gaps > 0 ? "limited" : "good") : "missing",
      detail: ryQ.data?.latest ? `${Math.round((ryQ.data.lagMs ?? 0) / 60000)} min alt${ryQ.data.gaps > 0 ? ` · ${ryQ.data.gaps} Lücken` : ""}` : "keine Frames",
    },
    {
      key: "qy", label: "Qualität QY",
      state: !showQy ? "missing" : qyQ.data?.latest ? "good" : "limited",
      detail: !showQy ? "Layer aus" : qyQ.data?.latest ? "Qualitätsfeld vorhanden" : "kein Frame geladen",
    },
    {
      key: "wn", label: "Nowcast WN",
      state: wnQ.data?.latest ? "good" : showWnNowcast ? "limited" : "missing",
      detail: wnQ.data?.latest ? `${wnQ.data.frames.length} Frames` : showWnNowcast ? "lädt" : "Layer aus",
    },
    {
      key: "blitz", label: "Blitz-Stream",
      state: lightning.status === "open" ? "good" : lightning.status === "connecting" ? "limited" : "missing",
      detail: `${lightning.status} · ${lightning.strikes.length} im 60-min-Puffer · Einzeleinschläge können falsch lokalisiert sein`,
    },
    {
      key: "model", label: "Modell",
      state: forecastQ.data ? "good" : forecastQ.isLoading ? "limited" : "missing",
      detail: forecastQ.data ? "Open-Meteo Forecast" : forecastQ.isLoading ? "lädt" : "nicht erreichbar",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-2">
        {storm.alerts.length > 0 && <StormAlertBanner alerts={storm.alerts} />}
        {hazards.alerts.length > 0 && <HazardAlertBanner alerts={hazards.alerts} />}
        <TopBar
          mode={mode}
          onModeChange={setMode}
          ry={ryQ.data ? assessTimeline("RY", ryQ.data, WMS_LAYERS.ry.stepMinutes) : { label: "RY", confidence: "missing", detail: "lädt…" }}
          wn={wnQ.data ? assessTimeline("WN", wnQ.data, WMS_LAYERS.wn.stepMinutes) : null}
          pi={piQ.data ? assessTimeline("PI", piQ.data, WMS_LAYERS.pi.stepMinutes) : null}
          qy={showQy ? (qyQ.data ? assessTimeline("QY", qyQ.data, WMS_LAYERS.qy.stepMinutes) : { label: "QY", confidence: "missing", detail: "lädt…" }) : null}
        />
        <div className="relative h-[60vh] min-h-[440px] w-full overflow-hidden rounded-xl border border-border bg-muted md:h-[68vh]">
          <RadarMap
            ref={mapRef}
            initialCenter={point}
            initialZoom={MODE_DEFS[mode].zoom}
            onBboxChange={setBbox}
          />
          <Legend layer={activeLayer} showLightning={showLightning} showQy={showQy} />
          <FrameBadge frame={activeFrame} scrub={scrub} />
        </div>
        <TimeScrubber
          value={scrub}
          min={minScrub}
          max={maxScrub}
          stepMinutes={5}
          playing={playing}
          onChange={(v) => { setPlaying(false); setScrub(v); if (v > 0) setShowWnNowcast(true); }}
          onPlay={() => setPlaying((p) => !p)}
          onJumpNow={() => { setPlaying(false); setScrub(0); }}
          disabled={ryFrames.length === 0}
        />
        <LayerToolbar
          showLightning={showLightning}
          onToggleLightning={() => setShowLightning((v) => !v)}
          showWn={showWnNowcast}
          onToggleWn={() => { setShowWnNowcast((v) => { if (v) setScrub(0); return !v; }); }}
          showQy={showQy}
          onToggleQy={() => setShowQy((v) => !v)}
          showRings={showRings}
          onToggleRings={() => setShowRings((v) => !v)}
          lightningStatus={lightning.status}
        />
      </div>

      <aside className="flex flex-col gap-3">
        <StormPanel
          cells={storm.cells}
          alerts={storm.alerts}
          activeEta={storm.activeEta}
          lightningOpen={lightning.status === "open"}
          hazardReports={hazards.reports}
        />
        <TriggerLightCard t={trig} />
        <BlitzRadarCard c={radarLight} />
        <ModelObsCard c={modelObs} />
        <CellTrackCard t={track} />
        <SourceConfidenceGrid items={sourceConfidence} />
      </aside>
    </div>
  );
}

/* ------------------------------ Topbar ------------------------------ */

function TopBar({
  mode, onModeChange, ry, wn, pi, qy,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  ry: ReturnType<typeof assessTimeline>;
  wn: ReturnType<typeof assessTimeline> | null;
  pi: ReturnType<typeof assessTimeline> | null;
  qy: ReturnType<typeof assessTimeline> | null;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 rounded-xl border border-border bg-card p-2 md:grid-cols-[auto_1fr_auto]">
      <div className="flex gap-1">
        {(Object.keys(MODE_DEFS) as Mode[]).map((m) => {
          const Icon = MODE_DEFS[m].icon;
          return (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {MODE_DEFS[m].label}
            </button>
          );
        })}
      </div>
      <div className="hidden text-[11px] text-muted-foreground md:block">
        Quelle: DWD GeoServer · Karte OSM
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HealthPill h={ry} />
        {wn && <HealthPill h={wn} />}
        {pi && <HealthPill h={pi} />}
        {qy && <HealthPill h={qy} />}
      </div>
    </div>
  );
}

function HealthPill({ h }: { h: { label: string; confidence: Confidence; detail: string } }) {
  const tone =
    h.confidence === "ok" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
    h.confidence === "delayed" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
    h.confidence === "degraded" ? "bg-orange-500/15 text-orange-700 dark:text-orange-300" :
    "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono", tone)}>
      <span className="font-semibold">{h.label}</span>
      <span className="opacity-80">{h.detail}</span>
    </span>
  );
}

/* ------------------------------ Legend + Badge ------------------------------ */

function FrameBadge({ frame, scrub }: { frame: string | null; scrub: number }) {
  const tag = scrub === 0 ? "Jetzt" : scrub < 0 ? "Verlauf" : "Nowcast";
  const tone =
    scrub === 0 ? "bg-emerald-500/90 text-white" :
    scrub < 0  ? "bg-slate-500/90 text-white" :
    "bg-sky-500/90 text-white";
  return (
    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
      <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide", tone)}>{tag}</span>
      {frame && (
        <span className="rounded-md bg-background/85 px-2 py-1 font-mono text-[11px] text-foreground backdrop-blur">
          {new Date(frame).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

function Legend({ layer, showLightning, showQy }: { layer: WmsLayerKey; showLightning: boolean; showQy: boolean }) {
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-[10px] backdrop-blur">
      <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">{WMS_LAYERS[layer].label} · Niederschlag</div>
      <div className="flex items-center gap-1">
        {["#bbdefb", "#42a5f5", "#1976d2", "#f59e0b", "#dc2626"].map((c) => (
          <span key={c} className="h-2.5 w-5 rounded-sm" style={{ backgroundColor: c }} />
        ))}
      </div>
      {showQy && (
        <div className="mt-1.5 flex items-center gap-2 text-muted-foreground">
          <ShieldAlert className="h-3 w-3" />
          <span>QY: gelb = mindere Qualität, rot = stark gestört</span>
        </div>
      )}
      {showLightning && (
        <div className="mt-1.5 flex items-center gap-2 text-muted-foreground">
          <Zap className="h-3 w-3" />
          <span className="inline-flex items-center gap-1"><Dot color="#facc15" /> 0–5</span>
          <span className="inline-flex items-center gap-1"><Dot color="#f59e0b" /> 5–15</span>
          <span className="inline-flex items-center gap-1"><Dot color="#9ca3af" /> 15–30 min</span>
        </div>
      )}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />;
}

/* ------------------------------ Time Scrubber ------------------------------ */

function TimeScrubber({
  value, min, max, stepMinutes, playing, onChange, onPlay, onJumpNow, disabled,
}: {
  value: number; min: number; max: number; stepMinutes: number;
  playing: boolean; onChange: (v: number) => void; onPlay: () => void; onJumpNow: () => void; disabled?: boolean;
}) {
  const offsetMin = value * stepMinutes;
  const label = offsetMin === 0 ? "Jetzt" : `${offsetMin > 0 ? "+" : ""}${offsetMin} min`;
  return (
    <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl border border-border bg-card px-2 py-2">
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled}>
        <SkipBack className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant={playing ? "default" : "outline"} className="h-8 w-8" onClick={onPlay} disabled={disabled}>
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
      <button onClick={onJumpNow} className="rounded-md border border-border px-2 py-1 font-mono text-[11px] text-foreground hover:bg-muted" disabled={disabled}>
        {label}
      </button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled}>
        <SkipForward className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ------------------------------ Layer Toolbar ------------------------------ */

function LayerToolbar({
  showLightning, onToggleLightning, showWn, onToggleWn, showQy, onToggleQy, showRings, onToggleRings, lightningStatus,
}: {
  showLightning: boolean; onToggleLightning: () => void;
  showWn: boolean; onToggleWn: () => void;
  showQy: boolean; onToggleQy: () => void;
  showRings: boolean; onToggleRings: () => void;
  lightningStatus: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
      <LayerChip active={true} label="RY" hint="Beobachtung 5 min" />
      <LayerChip active={showWn} onClick={onToggleWn} label="WN" hint="Nowcast +2 h" />
      <LayerChip active={showQy} onClick={onToggleQy} label="QY" hint="Radar-Qualität" icon={<ShieldAlert className="h-3 w-3" />} />
      <LayerChip
        active={showLightning}
        onClick={onToggleLightning}
        label="Blitze"
        icon={<Zap className="h-3 w-3" />}
        hint={`Blitzortung · ${lightningStatus}`}
      />
      <LayerChip active={showRings} onClick={onToggleRings} label="Ringe" icon={<Target className="h-3 w-3" />} hint="10 · 25 · 50 · 100 km" />
      <div className="ml-auto inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">
        <Activity className="h-3 w-3" /> Animation lädt nur bei Play
      </div>
    </div>
  );
}

function LayerChip({ active, onClick, label, hint, icon }: { active: boolean; onClick?: () => void; label: string; hint: string; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted",
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

/* ------------------------------ Analysis Rail ------------------------------ */

function AnalysisRail({
  ry, wn, pi, mode, lightning, lightningStatus,
}: {
  ry: ReturnType<typeof useQuery<any>>["data"];
  wn: ReturnType<typeof useQuery<any>>["data"];
  pi: ReturnType<typeof useQuery<any>>["data"];
  mode: Mode;
  lightning: ReturnType<typeof analyseLightning>;
  lightningStatus: string;
}) {
  const ryAge = ry?.latest ? Math.round((Date.now() - new Date(ry.latest).getTime()) / 60000) : null;
  const wnAvailable = wn?.frames?.length ?? 0;

  return (
    <aside className="flex flex-col gap-3">
      <RailCard title="Jetzt" tone="primary">
        {ryAge != null ? <Line label="Radar RY" value={`vor ${ryAge} min aktualisiert`} /> : <Line label="Radar RY" value="lädt…" />}
        <Line
          label="Blitze (5 min)"
          value={lightning.last5 > 0 ? `${lightning.last5}` : "keine"}
        />
        {lightning.bearingFromUser && lightning.last5 > 0 && (
          <Line label="Schwerpunkt" value={`Richtung ${lightning.bearingFromUser}`} />
        )}
      </RailCard>

      <RailCard title="Nächste 30 min">
        {wnAvailable > 0 ? (
          <>
            <Line label="Nowcast WN" value={`${Math.min(6, wnAvailable)} Frames geladen`} />
            <Line label="Blitztrend" value={trendLabel(lightning.trend)} />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Nowcast laden, indem WN im Zeitregler aktiviert wird.</p>
        )}
      </RailCard>

      <RailCard title="Nächste 2 h">
        {wnAvailable > 0 ? (
          <Line label="Reichweite" value={`+${wnAvailable * 5} min Nowcast verfügbar`} />
        ) : (
          <p className="text-xs text-muted-foreground">Aktiviere WN für Kurzfristausblick.</p>
        )}
        {mode === "europe" && pi?.latest && (
          <Line label="PI Composite" value={`Frame ${new Date(pi.latest).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`} />
        )}
      </RailCard>

      <RailCard title="Datenvertrauen" tone="muted">
        <Line label="RY" value={confidenceLabel(ry)} />
        <Line label="WN" value={confidenceLabel(wn)} />
        {mode === "europe" && <Line label="PI" value={confidenceLabel(pi)} />}
        <Line label="Blitz-Stream" value={lightningStatusLabel(lightningStatus)} />
      </RailCard>
    </aside>
  );
}

function RailCard({ title, children, tone = "default" }: { title: string; children: React.ReactNode; tone?: "default" | "primary" | "muted" }) {
  const toneClass =
    tone === "primary" ? "border-primary/40 bg-primary/5" :
    tone === "muted" ? "bg-muted/40" :
    "bg-card";
  return (
    <section className={cn("rounded-xl border border-border p-3", toneClass)}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid gap-1.5">{children}</div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-foreground">{value}</span>
    </div>
  );
}

function trendLabel(t: ReturnType<typeof analyseLightning>["trend"]) {
  switch (t) {
    case "rising": return "steigend";
    case "falling": return "fallend";
    case "steady": return "stabil";
    default: return "keine Aktivität";
  }
}

function confidenceLabel(t: any): string {
  if (!t || !t.latest) return "keine Daten";
  const lag = Math.round((Date.now() - new Date(t.latest).getTime()) / 60000);
  const gap = t.gaps > 0 ? ` · ${t.gaps} Lücke(n)` : "";
  return `${lag} min alt${gap}`;
}

function lightningStatusLabel(s: string) {
  switch (s) {
    case "open": return "live";
    case "connecting": return "verbinde…";
    case "closed": return "getrennt";
    case "error": return "Fehler";
    default: return "aus";
  }
}