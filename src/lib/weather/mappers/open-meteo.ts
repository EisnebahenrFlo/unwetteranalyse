import type {
  CurrentConditions, DailyPoint, ForecastBundle, GeoPoint, HourlyPoint,
  ModelSeries, MinutelyPoint, WeatherModelId,
} from "../types";

interface OmHourly {
  time: string[];
  temperature_2m?: number[]; apparent_temperature?: number[]; dew_point_2m?: number[];
  precipitation?: number[]; precipitation_probability?: number[];
  wind_speed_10m?: number[]; wind_gusts_10m?: number[];
  pressure_msl?: number[]; cloud_cover?: number[]; weather_code?: number[];
  cape?: number[]; lifted_index?: number[]; freezing_level_height?: number[]; snowfall?: number[];
  convective_inhibition?: number[];
  wind_speed_80m?: number[]; wind_speed_180m?: number[];
  wind_direction_80m?: number[]; wind_direction_180m?: number[];
  boundary_layer_height?: number[]; visibility?: number[]; uv_index?: number[];
  relative_humidity_2m?: number[];
}
interface OmDaily {
  time: string[];
  temperature_2m_min: number[]; temperature_2m_max: number[];
  precipitation_sum: number[]; precipitation_probability_max?: number[];
  wind_gusts_10m_max?: number[]; weather_code?: number[];
  sunrise?: string[]; sunset?: string[];
}
interface OmCurrent {
  time: string; temperature_2m: number; apparent_temperature?: number;
  relative_humidity_2m?: number; precipitation?: number;
  wind_speed_10m: number; wind_gusts_10m?: number; wind_direction_10m?: number;
  pressure_msl?: number; cloud_cover?: number; weather_code?: number;
}
interface OmMinutely {
  time: string[];
  precipitation?: number[];
  precipitation_probability?: number[];
  weather_code?: number[];
}

export function mapMinutely(m: OmMinutely | undefined): MinutelyPoint[] {
  if (!m?.time) return [];
  return m.time.map((t, i) => ({
    time: t,
    precipitationMm: m.precipitation?.[i],
    precipitationProbability: m.precipitation_probability?.[i],
    weatherCode: m.weather_code?.[i],
  }));
}

export function mapHourly(h: OmHourly | undefined): HourlyPoint[] {
  if (!h?.time) return [];
  return h.time.map((t, i) => ({
    time: t,
    temperatureC: h.temperature_2m?.[i] ?? Number.NaN,
    apparentTemperatureC: h.apparent_temperature?.[i],
    dewPointC: h.dew_point_2m?.[i],
    precipitationMm: h.precipitation?.[i],
    precipitationProbability: h.precipitation_probability?.[i],
    windSpeedMs: h.wind_speed_10m?.[i],
    windGustMs: h.wind_gusts_10m?.[i],
    pressureHpa: h.pressure_msl?.[i],
    cloudCover: h.cloud_cover?.[i],
    weatherCode: h.weather_code?.[i],
    cape: h.cape?.[i],
    liftedIndex: h.lifted_index?.[i],
    convectiveInhibition: h.convective_inhibition?.[i],
    windSpeed80mMs: h.wind_speed_80m?.[i],
    windSpeed180mMs: h.wind_speed_180m?.[i],
    windDirection80mDeg: h.wind_direction_80m?.[i],
    windDirection180mDeg: h.wind_direction_180m?.[i],
    boundaryLayerHeightM: h.boundary_layer_height?.[i],
    visibilityM: h.visibility?.[i],
    uvIndex: h.uv_index?.[i],
    relativeHumidity: h.relative_humidity_2m?.[i],
    freezingLevelM: h.freezing_level_height?.[i],
    snowfallCm: h.snowfall?.[i],
  }));
}

export function mapDaily(d: OmDaily | undefined): DailyPoint[] {
  if (!d?.time) return [];
  return d.time.map((date, i) => ({
    date,
    tempMinC: d.temperature_2m_min[i],
    tempMaxC: d.temperature_2m_max[i],
    precipitationSumMm: d.precipitation_sum[i],
    precipitationProbabilityMax: d.precipitation_probability_max?.[i],
    windGustMaxMs: d.wind_gusts_10m_max?.[i],
    weatherCode: d.weather_code?.[i],
    sunrise: d.sunrise?.[i],
    sunset: d.sunset?.[i],
  }));
}

export function mapCurrent(c: OmCurrent | undefined): CurrentConditions | undefined {
  if (!c) return undefined;
  return {
    observedAt: c.time,
    temperatureC: c.temperature_2m,
    apparentTemperatureC: c.apparent_temperature,
    relativeHumidity: c.relative_humidity_2m,
    windSpeedMs: c.wind_speed_10m,
    windGustMs: c.wind_gusts_10m,
    windDirectionDeg: c.wind_direction_10m,
    precipitationMm: c.precipitation,
    pressureHpa: c.pressure_msl,
    cloudCover: c.cloud_cover,
    weatherCode: c.weather_code,
  };
}

export function mapForecastBundle(
  raw: { hourly?: OmHourly; daily?: OmDaily; current?: OmCurrent; minutely_15?: OmMinutely; elevation?: number },
  point: GeoPoint,
): ForecastBundle {
  return {
    point,
    current: mapCurrent(raw.current),
    hourly: mapHourly(raw.hourly),
    daily: mapDaily(raw.daily),
    minutely: mapMinutely(raw.minutely_15),
    meta: {
      source: "open-meteo",
      updatedAt: new Date().toISOString(),
      resolutionKm: 11,
      uncertainty: "Best-Match Modell-Mix von Open-Meteo, Auflösung variiert je nach Region.",
    },
  };
}

export function mapModelSeries(
  raw: { hourly?: OmHourly },
  model: WeatherModelId, label: string, resolutionKm: number,
): ModelSeries {
  return {
    model, label, hourly: mapHourly(raw.hourly),
    meta: { source: "open-meteo", updatedAt: new Date().toISOString(), resolutionKm },
  };
}
