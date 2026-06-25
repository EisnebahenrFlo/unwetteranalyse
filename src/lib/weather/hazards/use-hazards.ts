import { useEffect, useMemo, useState } from "react";
import type { StormCell } from "@/lib/weather/storm/types";
import type { SavedLocation } from "@/lib/weather/types";
import { loadCellEnvironments, type CellEnvSample } from "@/lib/weather/storm/environment";
import { loadCellPrecipitation, type CellPrecipSample } from "./precipitation";
import { buildHazardReports } from "./engine";
import { computeHazardAlerts } from "./alerts";
import { recordHazardTransitions } from "./history";
import {
  DEFAULT_HAZARD_THRESHOLDS,
  type HazardAlert,
  type HazardCellReport,
  type HazardThresholds,
} from "./types";

export interface HazardResult {
  reports: HazardCellReport[];
  alerts: HazardAlert[];
  lastRun: number;
}

/**
 * Hazard-Pipeline: pro Tick (15 s) Reports neu berechnen und Alerts ableiten.
 * Async-Fetches (CAPE/LI, Niederschlag/Freezing Level) laufen parallel,
 * Ergebnisse fließen beim nächsten Render in die Reports ein.
 */
export function useHazards(opts: {
  cells: StormCell[];
  favorites: SavedLocation[];
  thresholds?: HazardThresholds;
  enabled?: boolean;
}): HazardResult {
  const { cells, favorites, enabled = true } = opts;
  const thresholds = opts.thresholds ?? DEFAULT_HAZARD_THRESHOLDS;

  const [env, setEnv] = useState<Map<string, CellEnvSample>>(new Map());
  const [precip, setPrecip] = useState<Map<string, CellPrecipSample>>(new Map());

  // Async-Fetcher anstoßen, sobald sich Centroide ändern (rounded grid).
  useEffect(() => {
    if (!enabled || cells.length === 0) return;
    const points = cells.map((c) => ({ lat: c.centroid.lat, lon: c.centroid.lon }));
    let cancelled = false;
    loadCellEnvironments(points)
      .then((m) => {
        if (!cancelled) setEnv(m);
      })
      .catch(() => {});
    loadCellPrecipitation(points)
      .then((m) => {
        if (!cancelled) setPrecip(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Key auf gerundete Centroide reduzieren, damit kleine Bewegungen nichts auslösen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    cells.map((c) => `${c.centroid.lat.toFixed(2)},${c.centroid.lon.toFixed(2)}`).join("|"),
  ]);

  return useMemo(() => {
    if (!enabled) return { reports: [], alerts: [], lastRun: Date.now() };
    const reports = buildHazardReports(cells, env, precip);
    const alerts = computeHazardAlerts(cells, reports, favorites, Date.now(), thresholds);
    // History-Transitions persistieren (Side-Effect, idempotent).
    if (alerts.length > 0) recordHazardTransitions(alerts);
    return { reports, alerts, lastRun: Date.now() };
  }, [
    enabled,
    cells,
    env,
    precip,
    favorites,
    thresholds.minLevel,
    thresholds.alertEtaMin,
    thresholds.hitKm,
    thresholds.enableHail,
    thresholds.enableFlood,
    thresholds.enableLightning,
  ]);
}
