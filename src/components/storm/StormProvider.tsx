import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { useSavedLocations } from "@/hooks/use-saved-locations";
import { useSettings } from "@/hooks/use-settings";
import { useLiveNow } from "@/hooks/use-live-now";
import { forecastQuery } from "@/lib/weather/queries";
import { liveHourly } from "@/lib/weather/live";
import { stormBackground } from "@/lib/weather/storm/background";
import { DEFAULT_STORM_THRESHOLDS } from "@/lib/weather/storm/types";

/**
 * Konfiguriert den globalen Stormtracking-Service einmalig pro App-Mount.
 * Lebt im Root-Layout, damit Detection, Lebensdauer und Zugbahnen
 * route-übergreifend laufen — auch ohne geöffnete Radar-Map.
 */
export function StormProvider() {
  const [settings] = useSettings();
  const favorites = useSavedLocations();
  const point = useActivePoint();
  const now = useLiveNow();
  const forecast = useQuery(forecastQuery(point));

  const nowHour = useMemo(() => {
    if (!forecast.data) return null;
    return liveHourly(forecast.data.hourly, now)[0] ?? null;
  }, [forecast.data, now]);

  const thresholds = useMemo(
    () => ({
      ...DEFAULT_STORM_THRESHOLDS,
      alertEtaMin: settings.storm.alertEtaMin,
      alertLevel: settings.storm.alertLevel,
    }),
    [settings.storm.alertEtaMin, settings.storm.alertLevel],
  );

  const environment = useMemo(
    () => ({
      cape: nowHour?.cape,
      liftedIndex: nowHour?.liftedIndex,
      validFor: nowHour?.time,
    }),
    [nowHour?.cape, nowHour?.liftedIndex, nowHour?.time],
  );

  useEffect(() => {
    stormBackground.configure({
      enabled: settings.storm.enabled,
      favorites,
      environment,
      thresholds,
    });
  }, [settings.storm.enabled, favorites, environment, thresholds]);

  return null;
}
