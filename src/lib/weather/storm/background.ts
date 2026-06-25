import type { SavedLocation } from "@/lib/weather/types";
import { fetchRadarSnapshot, type RadarSnapshot } from "@/lib/weather/radar/snapshot";
import { stepStormTracking, exportTrackState, importTrackState, resetStormTracking } from "./track";
import { computeStormAlerts } from "./alerts";
import { gridKey, loadCellEnvironments, type CellEnvSample } from "./environment";
import { scoreCell } from "./severity";
import { isInRegion, regionCountryPrefix } from "./region";
import {
  DEFAULT_STORM_THRESHOLDS,
  type StormAlert,
  type StormCell,
  type StormEnvironment,
  type StormThresholds,
} from "./types";

/**
 * Globaler Stormtracking-Service. Pollt alle 60 s einen Radar-Snapshot
 * vom DWD-WMS, klassifiziert Zellen und führt das Frame-zu-Frame-Tracking.
 * Lebt route-übergreifend, damit IDs und Zugbahnen erhalten bleiben.
 */

export type SnapshotStatus = "idle" | "loading" | "ok" | "error";

export interface StormBackgroundSnapshot {
  cells: StormCell[];
  alerts: StormAlert[];
  lastRun: number;
  lastFrameTime: string | null;
  snapshotStatus: SnapshotStatus;
  lastError: string | null;
}

interface ServiceConfig {
  enabled: boolean;
  favorites: SavedLocation[];
  environment: StormEnvironment;
  thresholds: StormThresholds;
}

const TICK_MS = 60_000;
const PERSIST_KEY = "meteoflo.storm.tracks.v2";
const PERSIST_INTERVAL_MS = 60_000;

const EMPTY_SNAPSHOT: StormBackgroundSnapshot = {
  cells: [],
  alerts: [],
  lastRun: 0,
  lastFrameTime: null,
  snapshotStatus: "idle",
  lastError: null,
};

class StormBackgroundService {
  private tickTimer: number | null = null;
  private persistTimer: number | null = null;
  private cellEnv: Map<string, CellEnvSample> = new Map();
  private envFetchPending = false;
  private listeners = new Set<() => void>();
  private snapshot: StormBackgroundSnapshot = EMPTY_SNAPSHOT;
  private config: ServiceConfig = {
    enabled: false,
    favorites: [],
    environment: {},
    thresholds: DEFAULT_STORM_THRESHOLDS,
  };
  private started = false;
  private persistLoaded = false;
  private tickInFlight = false;

  configure(patch: Partial<ServiceConfig>) {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...patch };
    if (this.config.enabled && !wasEnabled) this.start();
    else if (!this.config.enabled && wasEnabled) this.stop();
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getSnapshot(): StormBackgroundSnapshot {
    return this.snapshot;
  }

  reset() {
    resetStormTracking();
    this.cellEnv.clear();
    try {
      window.localStorage.removeItem(PERSIST_KEY);
    } catch {
      /* noop */
    }
    this.snapshot = { ...EMPTY_SNAPSHOT };
    this.emit();
    if (this.started) this.tick();
  }

  private start() {
    if (typeof window === "undefined" || this.started) return;
    this.started = true;
    this.loadPersisted();
    this.tick();
    this.tickTimer = window.setInterval(() => this.tick(), TICK_MS);
    this.persistTimer = window.setInterval(() => this.persist(), PERSIST_INTERVAL_MS);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private stop() {
    if (!this.started) return;
    this.started = false;
    if (this.tickTimer) window.clearInterval(this.tickTimer);
    if (this.persistTimer) window.clearInterval(this.persistTimer);
    this.tickTimer = this.persistTimer = null;
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private onVisibility = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "visible" && this.started) {
      // Sofortiger Refresh beim Zurückkehren.
      this.tick();
    }
  };

  private async tick() {
    if (!this.started || this.tickInFlight) return;
    this.tickInFlight = true;
    this.setStatus("loading");
    try {
      const snap = await fetchRadarSnapshot(null);
      this.processSnapshot(snap);
    } catch (err) {
      this.snapshot = {
        ...this.snapshot,
        snapshotStatus: "error",
        lastError: err instanceof Error ? err.message : String(err),
      };
      this.emit();
    } finally {
      this.tickInFlight = false;
    }
  }

  private setStatus(status: SnapshotStatus) {
    if (this.snapshot.snapshotStatus === status) return;
    this.snapshot = { ...this.snapshot, snapshotStatus: status };
    this.emit();
  }

  private processSnapshot(snap: RadarSnapshot) {
    const now = Date.now();
    const regional: StormEnvironment = { ...this.config.environment, source: "region" };
    const cellsInRegion = snap.cells.filter((c) =>
      isInRegion(c.centroid.lat, c.centroid.lon, 0),
    );
    const baseCells = stepStormTracking(cellsInRegion, regional, now, this.config.thresholds);

    const cells = baseCells.map((cell) => {
      const sample = this.cellEnv.get(gridKey(cell.centroid.lat, cell.centroid.lon));
      if (!sample || (sample.cape == null && sample.liftedIndex == null)) return cell;
      const env: StormEnvironment = {
        cape: sample.cape ?? this.config.environment.cape,
        liftedIndex: sample.liftedIndex ?? this.config.environment.liftedIndex,
        windGustMs: sample.windGustMs ?? this.config.environment.windGustMs,
        validFor: sample.validFor ?? this.config.environment.validFor,
        source: "cell",
      };
      const severity = scoreCell({
        topDbz: cell.topDbz,
        hailCoreAreaKm2: cell.hailCoreAreaKm2,
        areaKm2: cell.areaKm2,
        dbzTrend: cell.dbzTrend,
        areaTrend: cell.areaTrend,
        env,
      });
      return { ...cell, severity };
    });

    cells.sort((a, b) => b.severity.score - a.severity.score || b.areaKm2 - a.areaKm2);

    // Anzeigenamen vergeben: pro Land fortlaufender Index nach Severity-Rang.
    const perCountry: Record<string, number> = {};
    const named = cells.map((cell) => {
      const prefix = regionCountryPrefix(cell.centroid.lat, cell.centroid.lon);
      const idx = (perCountry[prefix] = (perCountry[prefix] ?? 0) + 1);
      const letter = String.fromCharCode(64 + Math.min(26, idx));
      const displayName = `Zelle ${prefix}-${letter}${idx > 26 ? idx - 26 : ""}`;
      return { ...cell, displayName };
    });

    if (named.length && !this.envFetchPending) {
      this.envFetchPending = true;
      const points = named.map((c) => ({ lat: c.centroid.lat, lon: c.centroid.lon }));
      loadCellEnvironments(points)
        .then((map) => {
          this.cellEnv = map;
        })
        .catch(() => {
          /* gehandhabt im Modul */
        })
        .finally(() => {
          this.envFetchPending = false;
        });
    }

    const alerts = computeStormAlerts(named, this.config.favorites, now, this.config.thresholds);

    this.snapshot = {
      cells: named,
      alerts,
      lastRun: now,
      lastFrameTime: snap.frameTime,
      snapshotStatus: "ok",
      lastError: null,
    };
    this.emit();
  }

  private emit() {
    for (const cb of this.listeners) cb();
  }

  private loadPersisted() {
    if (this.persistLoaded || typeof window === "undefined") return;
    this.persistLoaded = true;
    try {
      const raw = window.localStorage.getItem(PERSIST_KEY);
      if (!raw) return;
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) importTrackState(entries);
    } catch {
      /* ignorieren */
    }
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      const entries = exportTrackState();
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(entries));
    } catch {
      /* Quota / SSR */
    }
  }
}

export const stormBackground = new StormBackgroundService();