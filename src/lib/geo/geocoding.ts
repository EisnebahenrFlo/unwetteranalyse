import type { GeoPoint } from "../weather/types";

const URL_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const ALLOWED_COUNTRIES = new Set(["DE", "AT", "CH", "LI", "IT"]);

export async function searchLocations(query: string, language = "de"): Promise<GeoPoint[]> {
  if (query.trim().length < 2) return [];
  const url = new URL(URL_BASE);
  url.searchParams.set("name", query);
  url.searchParams.set("language", language);
  url.searchParams.set("count", "10");
  url.searchParams.set("format", "json");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = await res.json();
  return (data.results ?? [])
    .filter((r: { country_code: string }) => ALLOWED_COUNTRIES.has(r.country_code))
    .map((r: {
      latitude: number; longitude: number; name: string; country_code: string;
      admin1?: string; elevation?: number;
    }) => ({
      lat: r.latitude, lon: r.longitude, name: r.name,
      country: r.country_code, admin: r.admin1, elevation: r.elevation,
    }));
}
