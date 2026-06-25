import type { CurrentConditions, StationObservation, WeatherAlert } from "../types";
import { capSeverityToAlert, capSeverityToLevel } from "@/lib/weather/thresholds/warn-level";

/** Bright Sky liefert standardmäßig DWD-Einheiten: Temperatur °C, Wind km/h,
 *  Druck hPa, Niederschlag mm. Wir rechnen Wind in m/s, damit der Rest der App
 *  einheitlich in SI bleibt. */
const KMH_TO_MS = 1 / 3.6;
const toMs = (kmh?: number) => (kmh == null ? undefined : kmh * KMH_TO_MS);

/** Bright Sky /current_weather liefert rollierende Fenster mit Suffix
 *  `_10`, `_30`, `_60`. Wir bevorzugen das 10-Minuten-Fenster und fallen
 *  bei Lücken auf 30 bzw. 60 zurück, statt stumm `undefined` zu zeigen. */
function pickRolling<T>(w: Record<string, unknown>, key: string): T | undefined {
  for (const suffix of ["_10", "_30", "_60", ""]) {
    const v = w[`${key}${suffix}`];
    if (v != null) return v as T;
  }
  return undefined;
}

/** Bright Sky `icon` (z. B. "partly-cloudy-day", "thunderstorm") grob in einen
 *  WMO-Code übersetzen, damit Symbol und Label konsistent zur Modellanzeige sind. */
function iconToWmoCode(icon?: string): number | undefined {
  switch (icon) {
    case "clear-day":
    case "clear-night": return 0;
    case "partly-cloudy-day":
    case "partly-cloudy-night": return 2;
    case "cloudy": return 3;
    case "fog": return 45;
    case "wind": return 3;
    case "rain": return 63;
    case "sleet": return 67;
    case "snow": return 73;
    case "hail": return 96;
    case "thunderstorm": return 95;
    default: return undefined;
  }
}

export function mapBrightSkyCurrent(raw: {
  weather?: Record<string, unknown> & { timestamp: string; icon?: string; condition?: string };
  sources?: Array<{ distance?: number; station_name?: string }>;
}): CurrentConditions | undefined {
  const w = raw.weather;
  if (!w) return undefined;
  const temperature = w["temperature"] as number | undefined;
  const windKmh = pickRolling<number>(w, "wind_speed");
  const gustKmh = pickRolling<number>(w, "wind_gust_speed");
  const windDir = pickRolling<number>(w, "wind_direction");
  const precip = pickRolling<number>(w, "precipitation");
  return {
    observedAt: w.timestamp,
    temperatureC: temperature ?? Number.NaN,
    dewPointC: w["dew_point"] as number | undefined,
    relativeHumidity: w["relative_humidity"] as number | undefined,
    windSpeedMs: toMs(windKmh) ?? Number.NaN,
    windGustMs: toMs(gustKmh),
    windDirectionDeg: windDir,
    precipitationMm: precip,
    pressureHpa: w["pressure_msl"] as number | undefined,
    cloudCover: w["cloud_cover"] as number | undefined,
    weatherCode: iconToWmoCode(w.icon),
  };
}

export function mapBrightSkyStations(raw: {
  weather?: Array<{
    timestamp: string; source_id: number;
    temperature?: number; dew_point?: number;
    wind_speed?: number; wind_gust_speed?: number;
    pressure_msl?: number; precipitation?: number; cloud_cover?: number;
  }>;
  sources?: Array<{
    id: number; station_name?: string; dwd_station_id?: string;
    lat: number; lon: number; distance?: number;
  }>;
}): StationObservation[] {
  const sources = raw.sources ?? [];
  const weather = raw.weather ?? [];
  const latestPerSource = new Map<number, (typeof weather)[number]>();
  for (const w of weather) {
    const prev = latestPerSource.get(w.source_id);
    if (!prev || new Date(w.timestamp) > new Date(prev.timestamp)) {
      latestPerSource.set(w.source_id, w);
    }
  }
  const stations: StationObservation[] = [];
  for (const src of sources) {
    const w = latestPerSource.get(src.id);
    if (!w) continue;
    stations.push({
      stationId: src.dwd_station_id ?? String(src.id),
      stationName: src.station_name ?? `Station ${src.id}`,
      distanceKm: src.distance ? src.distance / 1000 : 0,
      lat: src.lat,
      lon: src.lon,
      observedAt: w.timestamp,
      temperatureC: w.temperature,
      dewPointC: w.dew_point,
      windSpeedMs: toMs(w.wind_speed),
      windGustMs: toMs(w.wind_gust_speed),
      pressureHpa: w.pressure_msl,
      precipitationMm: w.precipitation,
      cloudCover: w.cloud_cover,
    });
  }
  stations.sort((a, b) => a.distanceKm - b.distanceKm);
  return stations;
}

export function mapBrightSkyAlerts(raw: {
  alerts?: Array<{
    id?: string | number; alert_id?: string;
    event_en?: string; event_de?: string; event_code?: number;
    severity?: string;
    headline_de?: string; headline_en?: string;
    description_de?: string; instruction_de?: string;
    onset?: string; expires?: string; effective?: string;
  }>;
}): WeatherAlert[] {
  return (raw.alerts ?? []).map((a, idx) => ({
    id: String(a.alert_id ?? a.id ?? idx),
    headline: a.headline_de ?? a.headline_en ?? a.event_de ?? a.event_en ?? "Wetterwarnung",
    description: a.description_de,
    instruction: a.instruction_de,
    severity: capSeverityToAlert(a.severity),
    warnLevel: capSeverityToLevel(a.severity),
    event: a.event_de ?? a.event_en ?? "Wetterereignis",
    eventCode: a.event_code,
    onset: a.onset ?? a.effective ?? new Date().toISOString(),
    expires: a.expires ?? new Date(Date.now() + 6 * 3600_000).toISOString(),
    source: "bright-sky",
  }));
}
