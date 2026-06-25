/**
 * Hazard-Alerts pro Favorit × Hazard.
 *
 * - Treffer-Logik nutzt den vorhandenen Storm-Forecast-Cone der Zelle.
 * - Pro `favoriteId × kind` eigener Cooldown (default 10 min).
 * - Headline fasst Diagnose in einem Satz zusammen.
 */

import type { StormCell } from "@/lib/weather/storm/types";
import type { SavedLocation } from "@/lib/weather/types";
import { distanceKm } from "@/lib/weather/storm/geo";
import {
  DEFAULT_HAZARD_THRESHOLDS,
  HAZARD_RANK,
  type HazardAlert,
  type HazardCellReport,
  type HazardKind,
  type HazardThresholds,
} from "./types";

const STORAGE_KEY = "meteoflo.hazard-alerts.v1";

interface StoredMeta {
  lastFiredAt: number;
}

function loadMeta(): Record<string, StoredMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredMeta>) : {};
  } catch {
    return {};
  }
}
function saveMeta(meta: Record<string, StoredMeta>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

function headlineFor(kind: HazardKind, report: HazardCellReport): string {
  if (kind === "hail") {
    const h = report.hail;
    if (h.meshsCm >= 2)
      return `Hagel bis ~${h.meshsCm.toFixed(1)} cm möglich (POH ${h.pohPercent}%)`;
    return `Hagelrisiko erhöht (POH ${h.pohPercent}%)`;
  }
  if (kind === "flood") {
    const f = report.flood;
    const ret = f.returnYears != null ? ` (T≈${f.returnYears}a)` : "";
    return `Starkregen ${Math.round(Math.max(f.rrMm.h1, f.rrMm.h3))} mm in kurzer Zeit${ret}`;
  }
  const l = report.lightning;
  if (l.jumpActive)
    return `Lightning Jump aktiv — Eskalation wahrscheinlich (${l.ratePerMin.toFixed(1)}/min)`;
  return `Hohe Blitzaktivität ${l.ratePerMin.toFixed(1)}/min`;
}

function pickKindReport(report: HazardCellReport, kind: HazardKind) {
  return kind === "hail" ? report.hail : kind === "flood" ? report.flood : report.lightning;
}

export function computeHazardAlerts(
  cells: StormCell[],
  reports: HazardCellReport[],
  favorites: SavedLocation[],
  now = Date.now(),
  thresholds: HazardThresholds = DEFAULT_HAZARD_THRESHOLDS,
): HazardAlert[] {
  if (!favorites.length || !cells.length) return [];
  const meta = loadMeta();
  const out: HazardAlert[] = [];
  const minRank = HAZARD_RANK[thresholds.minLevel];

  const reportById = new Map(reports.map((r) => [r.cellId, r] as const));

  const kindsEnabled: HazardKind[] = [];
  if (thresholds.enableHail) kindsEnabled.push("hail");
  if (thresholds.enableFlood) kindsEnabled.push("flood");
  if (thresholds.enableLightning) kindsEnabled.push("lightning");

  for (const cell of cells) {
    const report = reportById.get(cell.id);
    if (!report) continue;

    for (const fav of favorites) {
      // ETA aus Cone des Storm-Forecasts.
      const dNow = distanceKm(cell.centroid, fav);
      let etaMin: number | null = null;
      let bestDist = dNow;
      if (dNow <= thresholds.hitKm) etaMin = 0;
      for (const f of cell.forecast) {
        if (f.offsetMin > thresholds.alertEtaMin) break;
        const d = distanceKm({ lat: f.lat, lon: f.lon }, fav);
        const hit = thresholds.hitKm + f.sigmaKm * 1.5;
        if (d <= hit && etaMin === null) etaMin = f.offsetMin;
        if (d < bestDist) bestDist = d;
      }
      if (etaMin === null) continue;

      for (const kind of kindsEnabled) {
        const diag = pickKindReport(report, kind);
        if (HAZARD_RANK[diag.level] < minRank) continue;
        const id = `${cell.id}|${fav.id}|${kind}`;
        const last = meta[id]?.lastFiredAt ?? 0;
        const cooldownMs = thresholds.cooldownMin * 60_000;
        const cooldownActive = now - last < cooldownMs;
        const createdAt = cooldownActive && last > 0 ? last : now;
        meta[id] = { lastFiredAt: createdAt };
        out.push({
          id,
          cellId: cell.id,
          favoriteId: fav.id,
          favoriteName: fav.name,
          kind,
          level: diag.level,
          score: diag.score,
          etaMin,
          distanceKm: bestDist,
          headline: headlineFor(kind, report),
          createdAt,
          updatedAt: now,
        });
      }
    }
  }

  // GC > 2 h.
  for (const k of Object.keys(meta)) {
    if (now - meta[k].lastFiredAt > 2 * 60 * 60_000) delete meta[k];
  }
  saveMeta(meta);

  out.sort((a, b) => a.etaMin - b.etaMin || HAZARD_RANK[b.level] - HAZARD_RANK[a.level]);
  return out;
}
