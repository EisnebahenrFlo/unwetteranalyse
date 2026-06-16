/**
 * Bright Sky greift auf DWD Open Data zu (kostenlos, kein API-Key).
 * Docs: https://brightsky.dev/docs
 * Hinweis: Stationsdaten und Alerts sind nur für DACH zuverlässig.
 */
const BASE = "https://api.brightsky.dev";

export async function fetchBrightSkyCurrent(lat: number, lon: number) {
  const url = new URL(`${BASE}/current_weather`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Bright Sky current HTTP ${res.status}`);
  return res.json();
}

export async function fetchBrightSkyAlerts(lat: number, lon: number) {
  const url = new URL(`${BASE}/alerts`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Bright Sky alerts HTTP ${res.status}`);
  return res.json();
}

export async function fetchBrightSkyStations(lat: number, lon: number) {
  const now = new Date();
  const fromIso = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
  const url = new URL(`${BASE}/weather`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("date", fromIso);
  url.searchParams.set("max_dist", "50000");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Bright Sky weather HTTP ${res.status}`);
  return res.json();
}
