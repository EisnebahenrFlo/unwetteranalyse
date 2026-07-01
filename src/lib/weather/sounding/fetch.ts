/** Open-Meteo Pressure-Level-Fetch für Vertikalprofile (kostenlos, kein Key). */
const URL_BASE = "https://api.open-meteo.com/v1/forecast";

/** Standard-Drucklevel (hPa), von Boden nach oben. */
export const SOUNDING_LEVELS = [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150] as const;

const VARS = SOUNDING_LEVELS.flatMap((p) => [
  `temperature_${p}hPa`,
  `relative_humidity_${p}hPa`,
  `wind_speed_${p}hPa`,
  `wind_direction_${p}hPa`,
  `geopotential_height_${p}hPa`,
]);

const SURFACE_VARS = [
  "cape",
  "convective_inhibition",
  "lifted_index",
  "temperature_2m",
  "dew_point_2m",
];

export interface SoundingRaw {
  elevation: number;
  hourly: Record<string, Array<number | null>> & { time: string[] };
}

export async function fetchSounding(input: {
  lat: number;
  lon: number;
  model?: string;
}): Promise<SoundingRaw> {
  const url = new URL(URL_BASE);
  url.searchParams.set("latitude", String(input.lat));
  url.searchParams.set("longitude", String(input.lon));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("hourly", [...VARS, ...SURFACE_VARS].join(","));
  url.searchParams.set("forecast_days", "2");
  if (input.model) url.searchParams.set("models", input.model);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo Sounding HTTP ${res.status}`);
  return res.json();
}