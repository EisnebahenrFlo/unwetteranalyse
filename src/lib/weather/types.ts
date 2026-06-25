/**
 * Gemeinsame Domain-Typen für ForecastHub.
 * Werte stehen immer in SI-Einheiten (°C, m/s, mm, hPa, m), Umrechnung passiert nur im UI.
 */

export type WeatherSource = "open-meteo" | "bright-sky" | "dwd";

export interface DataMeta {
  source: WeatherSource;
  updatedAt: string;
  resolutionKm?: number;
  uncertainty?: string;
}

export interface GeoPoint {
  lat: number;
  lon: number;
  name: string;
  country?: string;
  admin?: string;
  elevation?: number;
}

export interface SavedLocation extends GeoPoint {
  id: string;
  addedAt: string;
}

export interface CurrentConditions {
  temperatureC: number;
  apparentTemperatureC?: number;
  dewPointC?: number;
  relativeHumidity?: number;
  windSpeedMs: number;
  windGustMs?: number;
  windDirectionDeg?: number;
  precipitationMm?: number;
  pressureHpa?: number;
  cloudCover?: number;
  weatherCode?: number;
  observedAt: string;
}

export interface HourlyPoint {
  time: string;
  temperatureC: number;
  apparentTemperatureC?: number;
  dewPointC?: number;
  precipitationMm?: number;
  precipitationProbability?: number;
  windSpeedMs?: number;
  windGustMs?: number;
  pressureHpa?: number;
  cloudCover?: number;
  weatherCode?: number;
  cape?: number;
  liftedIndex?: number;
  convectiveInhibition?: number;
  windSpeed80mMs?: number;
  windSpeed180mMs?: number;
  windDirection80mDeg?: number;
  windDirection180mDeg?: number;
  boundaryLayerHeightM?: number;
  visibilityM?: number;
  uvIndex?: number;
  relativeHumidity?: number;
  freezingLevelM?: number;
  snowfallCm?: number;
  // Höhenwerte für K-Index, Total Totals etc. (Open-Meteo Pressure-Level-API)
  temperature850hPa?: number;
  temperature700hPa?: number;
  temperature500hPa?: number;
  dewPoint850hPa?: number;
  dewPoint700hPa?: number;
}

export interface DailyPoint {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  precipitationSumMm: number;
  precipitationProbabilityMax?: number;
  windGustMaxMs?: number;
  weatherCode?: number;
  sunrise?: string;
  sunset?: string;
}

export interface ForecastBundle {
  point: GeoPoint;
  current?: CurrentConditions;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  minutely?: MinutelyPoint[];
  meta: DataMeta;
}

export interface MinutelyPoint {
  time: string;
  precipitationMm?: number;
  precipitationProbability?: number;
  weatherCode?: number;
}

export type WeatherModelId =
  | "icon_d2"
  | "icon_eu"
  | "icon_seamless"
  | "ecmwf_ifs025"
  | "ecmwf_aifs025"
  | "gfs_seamless"
  | "meteofrance_arome_france"
  | "meteofrance_arpege_europe"
  | "knmi_seamless"
  | "dmi_seamless"
  | "gem_seamless"
  | "ukmo_seamless";

export interface ModelSeries {
  model: WeatherModelId;
  label: string;
  hourly: HourlyPoint[];
  meta: DataMeta;
}

export interface WeatherModelInfo {
  id: WeatherModelId;
  label: string;
  provider: string;
  resolutionKm: number;
  region: string;
  horizonHours: number;
}

export type AlertSeverity = "minor" | "moderate" | "severe" | "extreme";

export interface WeatherAlert {
  id: string;
  headline: string;
  description?: string;
  instruction?: string;
  severity: AlertSeverity;
  warnLevel?: 1 | 2 | 3 | 4;
  event: string;
  eventCode?: number;
  onset: string;
  expires: string;
  source: WeatherSource;
}

export interface StationObservation {
  stationId: string;
  stationName: string;
  distanceKm: number;
  lat: number;
  lon: number;
  observedAt: string;
  temperatureC?: number;
  dewPointC?: number;
  windSpeedMs?: number;
  windGustMs?: number;
  pressureHpa?: number;
  precipitationMm?: number;
  cloudCover?: number;
  weatherCode?: number;
}
