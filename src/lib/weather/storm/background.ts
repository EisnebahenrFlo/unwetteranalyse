import type { SavedLocation } from "@/lib/weather/types";
import { decodeLzw, type LightningStrike } from "@/lib/weather/sources/blitzortung";
import { stepStormTracking, exportTrackState, importTrackState, resetStormTracking } from "./track";
import { computeStormAlerts } from "./alerts";
import { gridKey, loadCellEnvironments, type CellEnvSample } from "./environment";
import { scoreCell } from "./severity";
import {
  DEFAULT_STORM_THRESHOLDS,
  type StormAlert,
  type StormCell,
  type StormEnvironment,
  type StormThresholds,
} from "./types";

/**
 * Globaler Stormtracking-Service. Hält Blitzortung-WebSocket, Strike-Puffer,
 * Detection-Tick und Persistenz route-übergreifend am Leben, damit Lebensdauer,
 * Zugbahnen und ETA in jeder Ansicht verfügbar sind.
 */

export interface StormBackgroundSnapshot {
  cells: StormCell[];
  alerts: StormAlert[];
  strikes: LightningStrike[];
  lastRun: number;
  wsStatus: "idle" | "connecting" | "open" | "error" | "closed";
}

interface ServiceConfig {
  enabled: boolean;
  favorites: SavedLocation[];
  environment: StormEnvironment;
  thresholds: StormThresholds;
}

const WS_ENDPOINTS = ["wss://ws1.blitzortung.org/", "wss://ws7.blitzortung.org/", "wss://ws8.blitzortung.org/"];
const BUFFER_MS = 60 * 60 * 1000;
const TICK_MS = 15_000;
const PERSIST_KEY = "meteoflo.storm.tracks.v1";
const PERSIST_INTERVAL_MS = 60_000;

const EMPTY_SNAPSHOT: StormBackgroundSnapshot = {
  cells: [],
  alerts: [],
  strikes: [],
  lastRun: 0,
  wsStatus: "idle",
};

class StormBackgroundService {
  private buffer: LightningStrike[] = [];
  private ws: WebSocket | null = null;
  private endpointIdx = 0;
  private wsAttempt = 0;
  private wsStatus: StormBackgroundSnapshot["wsStatus"] = "idle";
  private reconnectTimer: number | null = null;
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

  configure(patch: Partial<ServiceConfig>) {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...patch };
    if (this.config.enabled && !wasEnabled) this.start();
    else if (!this.config.enabled && wasEnabled) this.stop();
    else if (this.started) this.tick();
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  getSnapshot(): StormBackgroundSnapshot {
    return this.snapshot;
  }

  reset() {
    resetStormTracking();
    this.cellEnv.clear();
    this.buffer = [];
    try { window.localStorage.removeItem(PERSIST_KEY); } catch { /* noop */ }
    this.snapshot = { ...EMPTY_SNAPSHOT, wsStatus: this.wsStatus };
    this.emit();
    if (this.started) this.tick();
  }

  private start() {
    if (typeof window === "undefined" || this.started) return;
    this.started = true;
    this.loadPersisted();
    this.connect();
    this.tickTimer = window.setInterval(() => this.tick(), TICK_MS);
    this.persistTimer = window.setInterval(() => this.persist(), PERSIST_INTERVAL_MS);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private stop() {
    if (!this.started) return;
    this.started = false;
    if (this.tickTimer) window.clearInterval(this.tickTimer);
    if (this.persistTimer) window.clearInterval(this.persistTimer);
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.tickTimer = this.persistTimer = this.reconnectTimer = null;
    document.removeEventListener("visibilitychange", this.onVisibility);
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState <= 1) ws.close();
    this.setStatus("idle");
  }

  private onVisibility = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden") {
      this.ws?.close();
    } else if (this.started && (!this.ws || this.ws.readyState >= 2)) {
      this.connect();
    }
  };

  private connect() {
    if (!this.started) return;
    const url = WS_ENDPOINTS[this.endpointIdx % WS_ENDPOINTS.length];
    this.endpointIdx++;
    this.setStatus("connecting");
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.wsAttempt = 0;
        this.setStatus("open");
        ws.send(JSON.stringify({ a: 111 }));
      };
      ws.onmessage = (evt) => {
        try {
          const raw = typeof evt.data === "string" ? evt.data : "";
          if (!raw) return;
          const json = decodeLzw(raw);
          const parsed = JSON.parse(json) as { time?: number; lat?: number; lon?: number };
          if (typeof parsed.lat !== "number" || typeof parsed.lon !== "number") return;
          const tsMs = typeof parsed.time === "number" ? Math.floor(parsed.time / 1_000_000) : Date.now();
          this.buffer.push({ time: tsMs, lat: parsed.lat, lon: parsed.lon });
        } catch { /* korruptes Frame ignorieren */ }
      };
      ws.onerror = () => this.setStatus("error");
      ws.onclose = () => {
        this.setStatus("closed");
        if (!this.started) return;
        const delay = Math.min(30_000, 1_000 * 2 ** this.wsAttempt++);
        this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
      };
    } catch {
      this.setStatus("error");
    }
  }

  private setStatus(s: StormBackgroundSnapshot["wsStatus"]) {
    if (this.wsStatus === s) return;
    this.wsStatus = s;
    this.snapshot = { ...this.snapshot, wsStatus: s };
    this.emit();
  }

  private tick() {
    if (!this.started) return;
    const now = Date.now();
    const cutoff = now - BUFFER_MS;
    if (this.buffer.length) this.buffer = this.buffer.filter((s) => s.time >= cutoff);

    const regionalEnv: StormEnvironment = { ...this.config.environment, source: "region" };
    const baseCells = stepStormTracking(this.buffer, regionalEnv, now, this.config.thresholds);

    const cells = baseCells.map((cell) => {
      const sample = this.cellEnv.get(gridKey(cell.centroid.lat, cell.centroid.lon));
      if (!sample || (sample.cape == null && sample.liftedIndex == null)) return cell;
      const env: StormEnvironment = {
        cape: sample.cape ?? this.config.environment.cape,
        liftedIndex: sample.liftedIndex ?? this.config.environment.liftedIndex,
        validFor: sample.validFor ?? this.config.environment.validFor,
        source: "cell",
      };
      const severity = scoreCell({
        strikeRatePerMin: cell.strikeRatePerMin,
        strikeRateTrend: cell.strikeRateTrend,
        radiusKm: cell.radiusKm,
        strikeCount: cell.strikeCount,
        env,
      });
      return { ...cell, severity };
    });
    cells.sort((a, b) => b.severity.score - a.severity.score || b.strikeCount - a.strikeCount);

    if (cells.length && !this.envFetchPending) {
      this.envFetchPending = true;
      const points = cells.map((c) => ({ lat: c.centroid.lat, lon: c.centroid.lon }));
      loadCellEnvironments(points)
        .then((map) => { this.cellEnv = map; })
        .catch(() => { /* gehandhabt im Modul */ })
        .finally(() => { this.envFetchPending = false; });
    }

    const alerts = computeStormAlerts(cells, this.config.favorites, now, this.config.thresholds);

    this.snapshot = {
      cells,
      alerts,
      strikes: this.buffer.slice(),
      lastRun: now,
      wsStatus: this.wsStatus,
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
    } catch { /* ignorieren */ }
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      const entries = exportTrackState();
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(entries));
    } catch { /* Quota / SSR */ }
  }
}

export const stormBackground = new StormBackgroundService();