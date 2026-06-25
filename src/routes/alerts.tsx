import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { brightSkyAlertsQuery, forecastQuery } from "@/lib/weather/queries";
import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { SeverityRail, alertSeverityToLevel } from "@/components/common/SeverityRail";
import { EmptyState } from "@/components/common/EmptyState";
import { ShieldCheck, ShieldAlert } from "@/components/icons";
import { formatHour, formatRelative } from "@/lib/weather/format";
import { deriveAlertsFromForecast, derivedToAlert } from "@/lib/weather/analysis/situation";
import { severityWeight } from "@/lib/weather/thresholds/dwd";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveNow } from "@/hooks/use-live-now";
import { liveHourly } from "@/lib/weather/live";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Warnlagen — ForecastHub" },
      {
        name: "description",
        content: "Offizielle DWD-Warnungen und eigene Schwellen-Auswertung nach DWD-Logik.",
      },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const point = useActivePoint();
  const now = useLiveNow();
  const official = useQuery(brightSkyAlertsQuery(point));
  const forecast = useQuery(forecastQuery(point));
  const derived = forecast.data
    ? deriveAlertsFromForecast({
        ...forecast.data,
        hourly: liveHourly(forecast.data.hourly, now),
      }).map((d) => ({ ...derivedToAlert(d), value: d.value, rule: d.rule }))
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Warnlagen</h1>
        <p className="text-xs text-muted-foreground">
          Offizielle DWD-Warnungen via Bright Sky (DACH) plus eigene Schwellen aus der
          Forecast-Analyse.
        </p>
      </div>

      <DataCard title="Offizielle Warnungen (DWD / Bright Sky)">
        {official.isLoading && <Skeleton className="h-20 w-full" />}
        {!official.isLoading && (official.data?.length ?? 0) === 0 && (
          <EmptyState
            title="Keine aktiven offiziellen Warnungen"
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        )}
        <div className="flex flex-col gap-2">
          {[...(official.data ?? [])]
            .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
            .map((a) => (
              <article key={a.id} className="rounded-md border border-border bg-background/50 p-3">
                <header className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-2">
                  <SeverityRail
                    level={alertSeverityToLevel(a.severity)}
                    orientation="vertical"
                    showLabel={false}
                    className="h-10"
                  />
                  <WarnBadge severity={a.severity} showLevel />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{a.headline}</h3>
                    <div className="text-[10px] text-muted-foreground">
                      {formatHour(a.onset)} bis {formatHour(a.expires)} · {formatRelative(a.onset)}
                    </div>
                  </div>
                </header>
                {a.description && (
                  <p className="mt-2 whitespace-pre-line text-xs text-foreground/90">
                    {a.description}
                  </p>
                )}
                {a.instruction && (
                  <p className="mt-2 rounded bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
                    {a.instruction}
                  </p>
                )}
              </article>
            ))}
        </div>
      </DataCard>

      <DataCard
        title="Eigene Schwellen-Analyse (DWD-orientiert)"
        subtitle="Aus dem Forecast der nächsten 48 h abgeleitet"
      >
        {forecast.isLoading && <Skeleton className="h-20 w-full" />}
        {derived.length === 0 && !forecast.isLoading && (
          <EmptyState
            title="Keine Schwelle ausgelöst"
            description="Forecast bleibt innerhalb der DWD-orientierten Werte."
            icon={<ShieldAlert className="h-5 w-5" />}
          />
        )}
        <div className="flex flex-col gap-2">
          {derived.map((d) => (
            <article key={d.id} className="rounded-md border border-border bg-background/50 p-3">
              <header className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-2">
                <SeverityRail
                  level={alertSeverityToLevel(d.severity)}
                  orientation="vertical"
                  showLabel={false}
                  className="h-10"
                />
                <WarnBadge severity={d.severity} />
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{d.headline}</h3>
                  <div className="text-[10px] text-muted-foreground">
                    erstmals erwartet {formatHour(d.onset)} · {formatRelative(d.onset)}
                  </div>
                </div>
              </header>
              <p className="mt-2 text-xs text-foreground/90">{d.description}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{d.instruction}</p>
            </article>
          ))}
        </div>
      </DataCard>
    </div>
  );
}
