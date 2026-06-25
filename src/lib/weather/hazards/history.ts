/**
 * Hazard-Verlauf pro Favorit. Wir schreiben jeden Level-Aufstieg
 * (none→watch, watch→elevated, ...) als Event in localStorage.
 * Retention: konfigurierbar (default 14 Tage), max 200 Events pro Favorit.
 *
 * Bewusst kein IndexedDB in v1 — Datenvolumen ist gering, localStorage
 * reicht und ist synchron-einfach.
 */

import {
  HAZARD_RANK,
  type HazardAlert,
  type HazardHistoryEvent,
  type HazardKind,
  type HazardLevel,
} from "./types";

const STORAGE_KEY = "meteoflo.hazard-history.v1";
const LAST_LEVEL_KEY = "meteoflo.hazard-last-level.v1";
const MAX_PER_FAVORITE = 200;

interface HistoryDoc {
  events: HazardHistoryEvent[];
}
interface LastLevelDoc {
  /** key = `${favoriteId}|${kind}` */
  [k: string]: HazardLevel;
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getHazardHistory(): HazardHistoryEvent[] {
  return load<HistoryDoc>(STORAGE_KEY, { events: [] }).events;
}

export function getFavoriteHistory(favoriteId: string, days = 14): HazardHistoryEvent[] {
  const cutoff = Date.now() - days * 24 * 60 * 60_000;
  return getHazardHistory()
    .filter((e) => e.favoriteId === favoriteId && e.occurredAt >= cutoff)
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

function lastLevelFor(map: LastLevelDoc, favoriteId: string, kind: HazardKind): HazardLevel {
  return map[`${favoriteId}|${kind}`] ?? "none";
}

/**
 * Vergleicht aktuelle Alerts mit dem letzten gespeicherten Level pro
 * favorite × kind und schreibt jeden Anstieg als Event. Rückstufungen
 * werden still im LastLevel-Index festgehalten, aber kein Event erzeugt.
 * Retention wird beim Schreiben angewendet.
 */
export function recordHazardTransitions(alerts: HazardAlert[], retentionDays = 14) {
  if (typeof window === "undefined") return;
  if (alerts.length === 0) return;

  const doc = load<HistoryDoc>(STORAGE_KEY, { events: [] });
  const last = load<LastLevelDoc>(LAST_LEVEL_KEY, {});
  const now = Date.now();
  const cutoff = now - retentionDays * 24 * 60 * 60_000;

  let mutated = false;

  for (const a of alerts) {
    const prev = lastLevelFor(last, a.favoriteId, a.kind);
    if (HAZARD_RANK[a.level] > HAZARD_RANK[prev]) {
      doc.events.push({
        id: `${a.id}|${now}`,
        favoriteId: a.favoriteId,
        cellId: a.cellId,
        kind: a.kind,
        level: a.level,
        score: a.score,
        headline: a.headline,
        reasons: [],
        occurredAt: now,
      });
      mutated = true;
    }
    if (HAZARD_RANK[a.level] !== HAZARD_RANK[prev]) {
      last[`${a.favoriteId}|${a.kind}`] = a.level;
      mutated = true;
    }
  }

  if (!mutated) return;

  // Retention + Cap pro Favorit.
  doc.events = doc.events.filter((e) => e.occurredAt >= cutoff);
  const byFav = new Map<string, HazardHistoryEvent[]>();
  for (const e of doc.events) {
    const arr = byFav.get(e.favoriteId) ?? [];
    arr.push(e);
    byFav.set(e.favoriteId, arr);
  }
  const trimmed: HazardHistoryEvent[] = [];
  for (const [, arr] of byFav) {
    arr.sort((a, b) => b.occurredAt - a.occurredAt);
    trimmed.push(...arr.slice(0, MAX_PER_FAVORITE));
  }
  doc.events = trimmed.sort((a, b) => b.occurredAt - a.occurredAt);

  save(STORAGE_KEY, doc);
  save(LAST_LEVEL_KEY, last);
  window.dispatchEvent(new Event("meteoflo:hazard-history-changed"));
}

export function clearHazardHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LAST_LEVEL_KEY);
  window.dispatchEvent(new Event("meteoflo:hazard-history-changed"));
}
