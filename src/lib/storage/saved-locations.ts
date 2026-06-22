import type { GeoPoint, SavedLocation } from "../weather/types";

/**
 * v2: ohne vorbelegte Default-Orte. Bestehender v1-Schlüssel wird beim
 * ersten Lesen ignoriert, damit die alten Defaults nicht wieder auftauchen.
 */
const KEY = "meteoflo.saved-locations.v2";

const isBrowser = () => typeof window !== "undefined";

function locationId(lat: number, lon: number) {
  return `loc-${lat.toFixed(4)}-${lon.toFixed(4)}`;
}

export function getSavedLocations(): SavedLocation[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLocation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l) => Number.isFinite(l?.lat) && Number.isFinite(l?.lon));
  } catch {
    return [];
  }
}

export function setSavedLocations(locations: SavedLocation[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(locations));
  window.dispatchEvent(new Event("meteoflo:locations-changed"));
}

export function addSavedLocation(point: GeoPoint): SavedLocation {
  const current = getSavedLocations();
  const id = locationId(point.lat, point.lon);
  const existing = current.find((l) => l.id === id);
  if (existing) return existing;
  const next: SavedLocation = { ...point, id, addedAt: new Date().toISOString() };
  setSavedLocations([...current, next]);
  return next;
}

export function removeSavedLocation(id: string) {
  setSavedLocations(getSavedLocations().filter((l) => l.id !== id));
}

/** Verschiebt einen Favoriten um delta Positionen (negativ = nach oben). */
export function moveSavedLocation(id: string, delta: number) {
  const list = getSavedLocations();
  const idx = list.findIndex((l) => l.id === id);
  if (idx === -1) return;
  const target = Math.max(0, Math.min(list.length - 1, idx + delta));
  if (target === idx) return;
  const next = list.slice();
  const [item] = next.splice(idx, 1);
  next.splice(target, 0, item);
  setSavedLocations(next);
}

/** Reine ID-basierte Sortierung — für später möglich Drag-Drop. */
export function reorderSavedLocations(orderedIds: string[]) {
  const list = getSavedLocations();
  const byId = new Map(list.map((l) => [l.id, l]));
  const next: SavedLocation[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item) { next.push(item); byId.delete(id); }
  }
  // Übrige hinten anhängen (z. B. neu hinzugekommene).
  for (const item of byId.values()) next.push(item);
  setSavedLocations(next);
}

export function isFavorite(point: { lat: number; lon: number }): boolean {
  const id = locationId(point.lat, point.lon);
  return getSavedLocations().some((l) => l.id === id);
}
