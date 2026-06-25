import type { SavedLocation } from "@/lib/weather/types";
import { distanceKm } from "./geo";
import {
  DEFAULT_STORM_THRESHOLDS,
  SEVERITY_RANK,
  type StormAlert,
  type StormCell,
  type StormThresholds,
} from "./types";

const STORAGE_KEY = "meteoflo.storm-alerts.v1";

interface StoredAlertMeta {
  /** Letzter Zeitpunkt, an dem ein Alert dieser ID ausgelöst wurde. */
  lastFiredAt: number;
}

function loadMeta(): Record<string, StoredAlertMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredAlertMeta>) : {};
  } catch {
    return {};
  }
}

function saveMeta(meta: Record<string, StoredAlertMeta>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

/**
 * Berechnet aktive Alerts: Für jeden Favoriten und jede Zelle
 * den nächsten Forecast-Punkt finden. Wenn Distanz <= hitKm UND
 * Severity >= Schwelle, Alert aktiv.
 */
export function computeStormAlerts(
  cells: StormCell[],
  favorites: SavedLocation[],
  now = Date.now(),
  thresholds: StormThresholds = DEFAULT_STORM_THRESHOLDS,
): StormAlert[] {
  if (favorites.length === 0 || cells.length === 0) return [];
  const meta = loadMeta();
  const alerts: StormAlert[] = [];
  const minRank = SEVERITY_RANK[thresholds.alertLevel];

  for (const cell of cells) {
    if (SEVERITY_RANK[cell.severity.level] < minRank) continue;
    for (const fav of favorites) {
      // Bereits jetzt nahe? ETA 0.
      const dNow = distanceKm(cell.centroid, fav);
      let etaMin: number | null = null;
      let bestDist = dNow;
      if (dNow <= thresholds.alertHitKm) etaMin = 0;

      for (const f of cell.forecast) {
        if (f.offsetMin > thresholds.alertEtaMin) break;
        const d = distanceKm({ lat: f.lat, lon: f.lon }, fav);
        const hitKm = thresholds.alertHitKm + f.sigmaKm * 1.5;
        if (d <= hitKm && etaMin === null) etaMin = f.offsetMin;
        if (d < bestDist) bestDist = d;
      }

      if (etaMin === null) continue;
      const id = `${cell.id}|${fav.id}`;
      const last = meta[id]?.lastFiredAt ?? 0;
      const cooldownMs = thresholds.alertCooldownMin * 60_000;
      const cooldownActive = now - last < cooldownMs;
      // Wir liefern den Alert trotzdem (UI), aber `createdAt` bleibt stabil im Cooldown.
      const createdAt = cooldownActive && last > 0 ? last : now;
      meta[id] = { lastFiredAt: createdAt };
      alerts.push({
        id,
        cellId: cell.id,
        favoriteId: fav.id,
        favoriteName: fav.name,
        etaMin,
        distanceKm: bestDist,
        level: cell.severity.level,
        createdAt,
        updatedAt: now,
      });
    }
  }

  // GC: Einträge älter als 2 h verwerfen.
  for (const k of Object.keys(meta)) {
    if (now - meta[k].lastFiredAt > 2 * 60 * 60_000) delete meta[k];
  }
  saveMeta(meta);

  alerts.sort((a, b) => a.etaMin - b.etaMin || SEVERITY_RANK[b.level] - SEVERITY_RANK[a.level]);
  return alerts;
}
