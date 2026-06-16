import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { brightSkyAlertsQuery, brightSkyCurrentQuery, forecastQuery } from "@/lib/weather/queries";
import { CurrentConditions } from "@/components/dashboard/CurrentConditions";
import { NextChange } from "@/components/dashboard/NextChange";
import { HourlyStrip } from "@/components/dashboard/HourlyStrip";
import { DailyStrip } from "@/components/dashboard/DailyStrip";
import { AlertsSummary } from "@/components/dashboard/AlertsSummary";
import { SevereWeatherPanel } from "@/components/dashboard/SevereWeatherPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { deriveAlertsFromForecast, derivedToAlert } from "@/lib/weather/analysis/situation";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — MeteoFlo" },
      { name: "description", content: "Aktuelle Lage, nächste 24 Stunden, 7-Tage-Trend und aktive Warnungen für deinen Ort." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const point = useActivePoint();
  const forecast = useQuery(forecastQuery(point));
  const bsCurrent = useQuery(brightSkyCurrentQuery(point));
  const bsAlerts = useQuery(brightSkyAlertsQuery(point));

  if (forecast.isLoading) return <DashboardSkeleton />;
  if (forecast.error || !forecast.data) {
    return <ErrorState message={forecast.error?.message ?? "Forecast nicht verfügbar."} onRetry={() => forecast.refetch()} />;
  }

  const bundle = forecast.data;
  const officialAlerts = bsAlerts.data ?? [];
  const derived = deriveAlertsFromForecast(bundle).map(derivedToAlert);
  const allAlerts = [...officialAlerts, ...derived];

  const currentMeta = bsCurrent.data
    ? { source: "bright-sky" as const, updatedAt: bsCurrent.data.observedAt, resolutionKm: 1, uncertainty: "Punktwert der nächsten DWD-Station." }
    : bundle.meta;

  return (
    <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <CurrentConditions current={bsCurrent.data ?? bundle.current} meta={currentMeta} />
      </div>
      <div className="lg:col-span-4">
        <NextChange bundle={bundle} />
      </div>
      <div className="lg:col-span-12">
        <AlertsSummary alerts={allAlerts} />
      </div>
      <div className="lg:col-span-12">
        <SevereWeatherPanel bundle={bundle} />
      </div>
      <div className="lg:col-span-12">
        <HourlyStrip bundle={bundle} />
      </div>
      <div className="lg:col-span-12">
        <DailyStrip bundle={bundle} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12">
      <Skeleton className="h-44 lg:col-span-8" />
      <Skeleton className="h-44 lg:col-span-4" />
      <Skeleton className="h-24 lg:col-span-12" />
      <Skeleton className="h-32 lg:col-span-12" />
      <Skeleton className="h-72 lg:col-span-12" />
    </div>
  );
}
