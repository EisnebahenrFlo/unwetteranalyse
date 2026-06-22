import { useEffect, useMemo, useState } from "react";
import type { LightningStrike } from "@/lib/weather/sources/blitzortung";
import type { SavedLocation } from "@/lib/weather/types";
import { stepStormTracking } from "./track";
import { computeStormAlerts } from "./alerts";
import { distanceKm } from "./geo";
import { scoreCell } from "./severity";
import { gridKey, loadCellEnvironments, type CellEnvSample } from "./environment";
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

  // Per-Cell CAPE/LI Cache. Wird asynchron befüllt und beim nächsten Render
  // angewendet — keine blockierende Abhängigkeit für die Detection.
  const [cellEnv, setCellEnv] = useState<Map<string, CellEnvSample>>(new Map());

  return useMemo(() => {
    if (!enabled) return { cells: [], alerts: [], activeEta: null, lastRun: Date.now() };
    const now = Date.now();
    const regionalEnv: StormEnvironment = { ...environment, source: "region" };
    const baseCells = stepStormTracking(strikes, regionalEnv, now, thresholds);

    // Severity pro Zelle mit lokaler Umgebung neu bewerten, wenn vorhanden.
    const cells: StormCell[] = baseCells.map((cell) => {
      const sample = cellEnv.get(gridKey(cell.centroid.lat, cell.centroid.lon));
      if (!sample || (sample.cape == null && sample.liftedIndex == null)) return cell;
      const env: StormEnvironment = {
        cape: sample.cape ?? environment.cape,
        liftedIndex: sample.liftedIndex ?? environment.liftedIndex,
        validFor: sample.validFor ?? environment.validFor,
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

    // Async Fetch der lokalen Umgebung pro Centroid anstoßen. Ergebnis fließt
    // beim nächsten Tick in die Severity ein.
    if (cells.length) {
      const points = cells.map((c) => ({ lat: c.centroid.lat, lon: c.centroid.lon }));
      loadCellEnvironments(points).then((map) => {
        // Nur State-Update, wenn sich tatsächlich etwas geändert hat.
        setCellEnv((prev) => {
          let changed = prev.size !== map.size;
          if (!changed) {
            for (const [k, v] of map) {
              const old = prev.get(k);
              if (!old || old.fetchedAt !== v.fetchedAt) { changed = true; break; }
            }
          }
          return changed ? map : prev;
        });
      }).catch(() => { /* gehandhabt im Modul */ });
    }

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
  }, [strikes, favorites, activePoint.lat, activePoint.lon, environment.cape, environment.liftedIndex, enabled, tick, cellEnv]);
}