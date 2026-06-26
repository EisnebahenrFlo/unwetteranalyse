/**
 * Open-Meteo Ensemble-Quelle (icon_eu_eps und Co.).
 * Docs: https://open-meteo.com/en/docs/ensemble-api
 */

const ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble";

const HOURLY_VARS = ["cape", "precipitation", "wind_gusts_10m"].join(",");

export interface EnsembleRaw {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  hourly?: { time: string[]; [key: string]: unknown };
  hourly_units?: Record<string, string>;
}

export async function fetchEnsemble(input: {
  lat: number;
  lon: number;
  model?: string;
  forecastDays?: number;
}): Promise<EnsembleRaw> {
  const params = new URLSearchParams({
    latitude: String(input.lat),
    longitude: String(input.lon),
    timezone: "auto",
    wind_speed_unit: "ms",
    hourly: HOURLY_VARS,
    models: input.model ?? "icon_eu_eps",
    forecast_days: String(Math.min(16, input.forecastDays ?? 5)),
  });
  const res = await fetch(`${ENSEMBLE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo Ensemble HTTP ${res.status}`);
  return (await res.json()) as EnsembleRaw;
}