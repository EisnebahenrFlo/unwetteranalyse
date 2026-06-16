import type { CurrentConditions, StationObservation, WeatherAlert, AlertSeverity } from "../types";

export function mapBrightSkyCurrent(raw: {
  weather?: {
    timestamp: string;
    temperature?: number; dew_point?: number; relative_humidity?: number;
    wind_speed?: number; wind_gust_speed?: number; wind_direction?: number;
    precipitation_10?: number; pressure_msl?: number; cloud_cover?: number;
    condition?: string; icon?: string;
  };
  sources?: Array<{ distance?: number; station_name?: string }>;
}): CurrentConditions | undefined {
  const w = raw.weather;
  if (!w) return undefined;
  return {
    observedAt: w.timestamp,
    temperatureC: w.temperature ?? Number.NaN,
    dewPointC: w.dew_point,
    relativeHumidity: w.relative_humidity,
    windSpeedMs: w.wind_speed ?? Number.NaN,
    windGustMs: w.wind_gust_speed,
    windDirectionDeg: w.wind_direction,
    precipitationMm: w.precipitation_10,
    pressureHpa: w.pressure_msl,
    cloudCover: w.cloud_cover,
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
      windSpeedMs: w.wind_speed,
      windGustMs: w.wind_gust_speed,
      pressureHpa: w.pressure_msl,
      precipitationMm: w.precipitation,
      cloudCover: w.cloud_cover,
    });
  }
  stations.sort((a, b) => a.distanceKm - b.distanceKm);
  return stations;
}

function mapSeverity(level?: number): AlertSeverity {
  switch (level) {
    case 4: return "extreme";
    case 3: return "severe";
    case 2: return "moderate";
    default: return "minor";
  }
}

export function mapBrightSkyAlerts(raw: {
  alerts?: Array<{
    id?: string | number; alert_id?: string;
    event_en?: string; event_de?: string; event_code?: number;
    severity?: string; level?: number;
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
    severity: mapSeverity(a.level),
    event: a.event_de ?? a.event_en ?? "Wetterereignis",
    eventCode: a.event_code,
    onset: a.onset ?? a.effective ?? new Date().toISOString(),
    expires: a.expires ?? new Date(Date.now() + 6 * 3600_000).toISOString(),
    source: "bright-sky",
  }));
}
