/**
 * Open-Meteo Quelle (kostenlos, kein API-Key).
 * Docs: https://open-meteo.com/en/docs
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const HOURLY_VARS = [
  "temperature_2m","apparent_temperature","dew_point_2m","relative_humidity_2m",
  "precipitation","precipitation_probability","wind_speed_10m","wind_gusts_10m",
  "wind_direction_10m","pressure_msl","cloud_cover","weather_code",
  "cape","lifted_index","freezing_level_height","snowfall",
].join(",");

const DAILY_VARS = [
  "temperature_2m_min","temperature_2m_max","precipitation_sum",
  "precipitation_probability_max","wind_gusts_10m_max","weather_code","sunrise","sunset",
].join(",");

const CURRENT_VARS = [
  "temperature_2m","apparent_temperature","relative_humidity_2m","precipitation",
  "wind_speed_10m","wind_gusts_10m","wind_direction_10m","pressure_msl",
  "cloud_cover","weather_code",
].join(",");

export interface FetchForecastInput {
  lat: number;
  lon: number;
  model?: string;
  pastDays?: number;
  forecastDays?: number;
}

export async function fetchOpenMeteoForecast(input: FetchForecastInput) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(input.lat));
  url.searchParams.set("longitude", String(input.lon));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("hourly", HOURLY_VARS);
  url.searchParams.set("daily", DAILY_VARS);
  url.searchParams.set("current", CURRENT_VARS);
  url.searchParams.set("forecast_days", String(input.forecastDays ?? 7));
  if (input.pastDays) url.searchParams.set("past_days", String(input.pastDays));
  if (input.model) url.searchParams.set("models", input.model);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo Forecast HTTP ${res.status}`);
  return res.json();
}

export async function fetchOpenMeteoModels(input: {
  lat: number; lon: number; models: string[]; forecastDays?: number;
}) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(input.lat));
  url.searchParams.set("longitude", String(input.lon));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("hourly",
    ["temperature_2m","precipitation","wind_speed_10m","wind_gusts_10m"].join(","));
  url.searchParams.set("forecast_days", String(input.forecastDays ?? 3));
  url.searchParams.set("models", input.models.join(","));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo Models HTTP ${res.status}`);
  return res.json();
}
