import type { GeoPoint, SavedLocation } from "../weather/types";

const KEY = "meteoflo.saved-locations.v1";

const DEFAULT_LOCATIONS: SavedLocation[] = [
  { id: "default-berlin", name: "Berlin", lat: 52.52, lon: 13.405, country: "DE", admin: "Berlin", addedAt: new Date(0).toISOString() },
  { id: "default-zurich", name: "Zürich", lat: 47.3769, lon: 8.5417, country: "CH", admin: "Zürich", addedAt: new Date(0).toISOString() },
  { id: "default-vienna", name: "Wien", lat: 48.2082, lon: 16.3738, country: "AT", admin: "Wien", addedAt: new Date(0).toISOString() },
  { id: "default-bolzano", name: "Bozen", lat: 46.4983, lon: 11.3548, country: "IT", admin: "Trentino-Südtirol", addedAt: new Date(0).toISOString() },
];

const isBrowser = () => typeof window !== "undefined";

export function getSavedLocations(): SavedLocation[] {
  if (!isBrowser()) return DEFAULT_LOCATIONS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LOCATIONS;
    const parsed = JSON.parse(raw) as SavedLocation[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LOCATIONS;
    return parsed;
  } catch {
    return DEFAULT_LOCATIONS;
  }
}

export function setSavedLocations(locations: SavedLocation[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(locations));
  window.dispatchEvent(new Event("meteoflo:locations-changed"));
}

export function addSavedLocation(point: GeoPoint): SavedLocation {
  const current = getSavedLocations();
  const id = `loc-${point.lat.toFixed(4)}-${point.lon.toFixed(4)}`;
  const existing = current.find((l) => l.id === id);
  if (existing) return existing;
  const next: SavedLocation = { ...point, id, addedAt: new Date().toISOString() };
  setSavedLocations([...current, next]);
  return next;
}

export function removeSavedLocation(id: string) {
  setSavedLocations(getSavedLocations().filter((l) => l.id !== id));
}
