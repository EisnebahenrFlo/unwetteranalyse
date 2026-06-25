import { useMemo, useSyncExternalStore } from "react";
import { distanceKm } from "./geo";
import { stormBackground, type StormBackgroundSnapshot } from "./background";
import {
  DEFAULT_STORM_THRESHOLDS,
  type StormAlert,
  type StormCell,
  type StormThresholds,
} from "./types";

export interface StormTrackingResult {
  cells: StormCell[];
  alerts: StormAlert[];
  activeEta: { cell: StormCell; etaMin: number; distanceKm: number } | null;
  lastRun: number;
  lastFrameTime: string | null;
  snapshotStatus: StormBackgroundSnapshot["snapshotStatus"];
}

const SERVER_SNAPSHOT: StormBackgroundSnapshot = {
  cells: [],
  alerts: [],
  lastRun: 0,
  lastFrameTime: null,
  snapshotStatus: "idle",
  lastError: null,
};

/**
 * Liest den globalen Stormtracking-Snapshot. Detection und Polling laufen
 * im Hintergrund (`stormBackground`), Lebensdauer und Zugbahnen bleiben
 * route-übergreifend erhalten.
 */
export function useStormTracking(opts: {
  activePoint: { lat: number; lon: number };
  thresholds?: StormThresholds;
}): StormTrackingResult {
  const { activePoint } = opts;
  const thresholds = opts.thresholds ?? DEFAULT_STORM_THRESHOLDS;

  const snapshot = useSyncExternalStore(
    (cb) => stormBackground.subscribe(cb),
    () => stormBackground.getSnapshot(),
    () => SERVER_SNAPSHOT,
  );

  const activeEta = useMemo(() => {
    let best: StormTrackingResult["activeEta"] = null;
    for (const cell of snapshot.cells) {
      let bestEta = Infinity;
      let bestDist = Infinity;
      const dNow = distanceKm(cell.centroid, activePoint);
      if (dNow <= thresholds.alertHitKm + cell.radiusKm) {
        bestEta = 0;
        bestDist = dNow;
      }
      for (const f of cell.forecast) {
        const d = distanceKm({ lat: f.lat, lon: f.lon }, activePoint);
        const hit = thresholds.alertHitKm + f.sigmaKm;
        if (d <= hit && f.offsetMin < bestEta) {
          bestEta = f.offsetMin;
          bestDist = d;
        }
      }
      if (Number.isFinite(bestEta) && (!best || bestEta < best.etaMin)) {
        best = { cell, etaMin: bestEta, distanceKm: bestDist };
      }
    }
    return best;
  }, [snapshot.cells, activePoint.lat, activePoint.lon, thresholds.alertHitKm]);

  return {
    cells: snapshot.cells,
    alerts: snapshot.alerts,
    activeEta,
    lastRun: snapshot.lastRun,
    lastFrameTime: snapshot.lastFrameTime,
    snapshotStatus: snapshot.snapshotStatus,
  };
}

export function useStormSnapshot(): StormBackgroundSnapshot {
  return useSyncExternalStore(
    (cb) => stormBackground.subscribe(cb),
    () => stormBackground.getSnapshot(),
    () => SERVER_SNAPSHOT,
  );
}

export type { StormAlert };