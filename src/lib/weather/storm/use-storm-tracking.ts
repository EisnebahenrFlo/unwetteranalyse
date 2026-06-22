import { useEffect, useMemo, useState } from "react";
import type { LightningStrike } from "@/lib/weather/sources/blitzortung";
import type { SavedLocation } from "@/lib/weather/types";
import { stepStormTracking } from "./track";
import { computeStormAlerts } from "./alerts";
import { distanceKm } from "./geo";
import {
  DEFAULT_STORM_THRESHOLDS,
  type StormAlert,
  type StormCell,
  type StormEnvironment,
  type StormThresholds,
} from "./types";

export interface StormTrackingResult {
  cells: StormCell[];
  alerts: StormAlert[];
  /** ETA / nächste Zelle für den aktiven Ort. */
  activeEta: { cell: StormCell; etaMin: number; distanceKm: number } | null;
  lastRun: number;
}

/**
 * Detection + Tracking + Alerts auf Basis des aktuellen Strike-Puffers.
 * Re-runs alle 15 s, unabhängig vom Strike-Stream — so wandern Cones
 * sichtbar weiter und Severity klingt korrekt ab.
 */
export function useStormTracking(opts: {
  strikes: LightningStrike[];
  favorites: SavedLocation[];
  activePoint: { lat: number; lon: number };
  environment: StormEnvironment;
  thresholds?: StormThresholds;
  enabled?: boolean;
}): StormTrackingResult {
  const { strikes, favorites, activePoint, environment, enabled = true } = opts;
  const thresholds = opts.thresholds ?? DEFAULT_STORM_THRESHOLDS;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 15_000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return useMemo(() => {
    if (!enabled) return { cells: [], alerts: [], activeEta: null, lastRun: Date.now() };
    const now = Date.now();
    const cells = stepStormTracking(strikes, environment, now, thresholds);
    const alerts = computeStormAlerts(cells, favorites, now, thresholds);

    // ETA zur aktiven Position: nächste Zelle, deren Forecast den Ort streift.
    let activeEta: StormTrackingResult["activeEta"] = null;
    for (const cell of cells) {
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
      if (Number.isFinite(bestEta)) {
        if (!activeEta || bestEta < activeEta.etaMin) {
          activeEta = { cell, etaMin: bestEta, distanceKm: bestDist };
        }
      }
    }

    return { cells, alerts, activeEta, lastRun: now };
    // tick triggert Re-Run alle 15 s.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strikes, favorites, activePoint.lat, activePoint.lon, environment.cape, environment.liftedIndex, enabled, tick]);
}