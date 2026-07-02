import { queryOptions } from "@tanstack/react-query";
import { fetchOpenMeteoForecast, fetchOpenMeteoSingleModel } from "./sources/open-meteo";
import {
  fetchBrightSkyCurrent,
  fetchBrightSkyAlerts,
  fetchBrightSkyStations,
} from "./sources/bright-sky";
import { fetchDwdRadarFrames } from "./sources/dwd-radar";
import { fetchEnsemble } from "./sources/open-meteo-ensemble";
import { mapForecastBundle, mapModelSeries } from "./mappers/open-meteo";
import {
  mapBrightSkyCurrent,
  mapBrightSkyStations,
  mapBrightSkyAlerts,
} from "./mappers/bright-sky";
import { WEATHER_MODELS } from "./models";
import { searchLocations } from "@/lib/geo/geocoding";
import type { GeoPoint } from "./types";
import { fetchSounding } from "./sounding/fetch";
import { buildSounding } from "./sounding/profile";
import { fetchEstofex } from "./sources/estofex.functions";
import type { WeatherAlert } from "./types";
import {
  fetchMeteoAlarm,
  fetchMeteoAlarmEdr,
  type MeteoAlarmRaw,
} from "./sources/meteoalarm.functions";
import { mapMeteoAlarm } from "./mappers/meteoalarm";
import { pointInPolygon } from "./geo/point-in-polygon";

const STALE = 10 * 60 * 1000;

export function forecastQuery(point: GeoPoint) {
  return queryOptions({
    queryKey: ["forecast", point.lat, point.lon],
    queryFn: async () => {
      const raw = await fetchOpenMeteoForecast({ lat: point.lat, lon: point.lon });
      return mapForecastBundle(raw, point);
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

export function brightSkyCurrentQuery(point: GeoPoint) {
  return queryOptions({
    queryKey: ["bs-current", point.lat, point.lon],
    queryFn: async () => {
      try {
        const raw = await fetchBrightSkyCurrent(point.lat, point.lon);
        return mapBrightSkyCurrent(raw) ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function brightSkyStationsQuery(point: GeoPoint) {
  return queryOptions({
    queryKey: ["bs-stations", point.lat, point.lon],
    queryFn: async () => {
      try {
        const raw = await fetchBrightSkyStations(point.lat, point.lon);
        return mapBrightSkyStations(raw);
      } catch {
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

async function fetchBrightSkyAlertsAsWeatherAlerts(point: GeoPoint): Promise<WeatherAlert[]> {
  try {
    const raw = await fetchBrightSkyAlerts(point.lat, point.lon);
    return mapBrightSkyAlerts(raw);
  } catch {
    return [];
  }
}

export function brightSkyAlertsQuery(point: GeoPoint) {
  return queryOptions({
    queryKey: ["bs-alerts", point.lat, point.lon],
    queryFn: () => fetchBrightSkyAlertsAsWeatherAlerts(point),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Kanonische Warnungen-Query. DE → DWD via Bright Sky (unverändert).
 * AT/CH/IT → MeteoAlarm-Legacy-Atom, punktgenau via Polygon wo verfügbar,
 * ansonsten landesweit. Unbekannte Länder fallen auf Bright Sky zurück.
 */
const FEED_BY_COUNTRY: Record<string, string> = {
  at: "austria",
  austria: "austria",
  "österreich": "austria",
  ch: "switzerland",
  switzerland: "switzerland",
  schweiz: "switzerland",
  it: "italy",
  italy: "italy",
  italien: "italy",
};

const EDR_ISO2: Record<string, string> = {
  at: "AT",
  austria: "AT",
  "österreich": "AT",
  ch: "CH",
  switzerland: "CH",
  schweiz: "CH",
  it: "IT",
  italy: "IT",
  italien: "IT",
};

function feedSlug(country?: string): string | null {
  if (!country) return null;
  return FEED_BY_COUNTRY[country.trim().toLowerCase()] ?? null;
}

function edrIso2(country?: string): string | null {
  if (!country) return null;
  return EDR_ISO2[country.trim().toLowerCase()] ?? null;
}

export function weatherAlertsQuery(point: GeoPoint) {
  const slug = feedSlug(point.country);
  const iso2 = edrIso2(point.country);
  return queryOptions({
    queryKey: ["weather-alerts", "edr", point.lat, point.lon, slug, iso2] as const,
    queryFn: async (): Promise<WeatherAlert[]> => {
      if (!slug) return fetchBrightSkyAlertsAsWeatherAlerts(point);
      // 1) EDR-first: amtliche GeoJSON, punktgenau per Geometrie.
      if (iso2) {
        const edr: MeteoAlarmRaw[] = await fetchMeteoAlarmEdr({
          data: { country: iso2, lat: point.lat, lon: point.lon },
        });
        if (edr.length > 0) {
          // Serverseitig bereits per BBox punktgenau gefiltert.
          return mapMeteoAlarm(edr);
        }
      }
      // 2) Fallback: Legacy-Atom (landesweit, ohne Key).
      const raw: MeteoAlarmRaw[] = await fetchMeteoAlarm({ data: { feed: slug } });
      const filtered = raw.filter((a) =>
        a.polygons.length === 0
          ? true
          : a.polygons.some((poly) => pointInPolygon(point.lon, point.lat, poly)),
      );
      return mapMeteoAlarm(filtered);
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/** DWD-Radar-Frames als globaler Status. Eine einzige Quelle für Karte und
 *  Systemstatus, damit Frame-Stand und Sichtbarkeit konsistent sind. */
export const dwdRadarFramesQuery = queryOptions({
  queryKey: ["dwd-radar"] as const,
  queryFn: fetchDwdRadarFrames,
  staleTime: 5 * 60 * 1000,
  refetchInterval: 5 * 60 * 1000,
  retry: 1,
});

export function modelComparisonQuery(point: GeoPoint) {
  return queryOptions({
    queryKey: ["model-compare", point.lat, point.lon],
    queryFn: async () => {
      const results = await Promise.all(
        WEATHER_MODELS.map(async (info) => {
          const forecastDays = Math.min(16, Math.ceil(info.horizonHours / 24));
          try {
            const raw = await fetchOpenMeteoSingleModel({
              lat: point.lat,
              lon: point.lon,
              model: info.id,
              forecastDays,
            });
            return mapModelSeries(raw, info.id, info.label, info.resolutionKm);
          } catch {
            return mapModelSeries({}, info.id, info.label, info.resolutionKm);
          }
        }),
      );
      return results;
    },
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

export function geocodingQuery(query: string) {
  return queryOptions({
    queryKey: ["geocoding", query],
    queryFn: () => searchLocations(query),
    enabled: query.trim().length >= 2,
    staleTime: 60 * 60 * 1000,
  });
}

export function ensembleQuery(point: GeoPoint) {
  return queryOptions({
    queryKey: ["ensemble", point.lat, point.lon] as const,
    queryFn: () => fetchEnsemble({ lat: point.lat, lon: point.lon }),
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

export function soundingQuery(point: GeoPoint) {
  return queryOptions({
    queryKey: ["sounding", point.lat, point.lon] as const,
    queryFn: () => fetchSounding({ lat: point.lat, lon: point.lon }),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

export const estofexQuery = queryOptions({
  queryKey: ["estofex"] as const,
  queryFn: () => fetchEstofex(),
  staleTime: 30 * 60 * 1000,
  refetchInterval: 30 * 60 * 1000,
  retry: 1,
});

export { buildSounding };
