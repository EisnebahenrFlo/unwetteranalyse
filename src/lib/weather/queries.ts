import { queryOptions } from "@tanstack/react-query";
import { fetchOpenMeteoForecast, fetchOpenMeteoSingleModel } from "./sources/open-meteo";
import { fetchBrightSkyCurrent, fetchBrightSkyAlerts, fetchBrightSkyStations } from "./sources/bright-sky";
import { mapForecastBundle, mapModelSeries } from "./mappers/open-meteo";
import { mapBrightSkyCurrent, mapBrightSkyStations, mapBrightSkyAlerts } from "./mappers/bright-sky";
import { WEATHER_MODELS } from "./models";
import { searchLocations } from "@/lib/geo/geocoding";
import type { GeoPoint } from "./types";

const STALE = 10 * 60 * 1000;

export function forecastQuery(point: GeoPoint) {
  return queryOptions({
    queryKey: ["forecast", point.lat, point.lon],
    queryFn: async () => {
      const raw = await fetchOpenMeteoForecast({ lat: point.lat, lon: point.lon });
      return mapForecastBundle(raw, point);
    },
    staleTime: STALE,
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
  });
}

export function brightSkyAlertsQuery(point: GeoPoint) {
  return queryOptions({
    queryKey: ["bs-alerts", point.lat, point.lon],
    queryFn: async () => {
      try {
        const raw = await fetchBrightSkyAlerts(point.lat, point.lon);
        return mapBrightSkyAlerts(raw);
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function modelComparisonQuery(point: GeoPoint) {
  return queryOptions({
    queryKey: ["model-compare", point.lat, point.lon],
    queryFn: async () => {
      const results = await Promise.all(WEATHER_MODELS.map(async (info) => {
        try {
          const raw = await fetchOpenMeteoSingleModel({
            lat: point.lat, lon: point.lon, model: info.id, forecastDays: 3,
          });
          return mapModelSeries(raw, info.id, info.label, info.resolutionKm);
        } catch {
          return mapModelSeries({}, info.id, info.label, info.resolutionKm);
        }
      }));
      return results;
    },
    staleTime: STALE,
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
