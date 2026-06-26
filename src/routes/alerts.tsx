import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { brightSkyAlertsQuery, forecastQuery } from "@/lib/weather/queries";
import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import {
  SeverityRail,
  alertSeverityToLevel,
  type SeverityLevel,
} from "@/components/common/SeverityRail";
import { EmptyState } from "@/components/common/EmptyState";
import { ShieldCheck, ShieldAlert } from "@/components/icons";
import { formatHour, formatRelative } from "@/lib/weather/format";
import { deriveAlertsFromForecast, derivedToAlert } from "@/lib/weather/analysis/situation";
import { severityWeight } from "@/lib/weather/thresholds/dwd";
import { WARN_LEVEL } from "@/lib/weather/thresholds/warn-level";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveNow } from "@/hooks/use-live-now";
import { liveHourly } from "@/lib/weather/live";
import type { AlertSeverity, WeatherAlert } from "@/lib/weather/types";
import type { ReactNode } from "react";

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

  const officialAge = official.dataUpdatedAt
    ? Math.round((now.getTime() - official.dataUpdatedAt) / 60_000)
    : null;
  const forecastAge = forecast.dataUpdatedAt
    ? Math.round((now.getTime() - forecast.dataUpdatedAt) / 60_000)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Warnlagen
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          Aktive Warnungen, höchste Stufe zuerst
        </h1>
        <p className="text-sm text-muted-foreground">
          Offizielle DWD-Warnungen für Deutschland via Bright Sky plus eigene Schwellen
          aus der Forecast-Analyse. (AT/CH/IT: amtliche Warnungen folgen über MeteoAlarm.)
        </p>
      </header>

      <DataCard
        title="Offizielle Warnungen (DWD / Bright Sky)"
        subtitle={
          officialAge != null
            ? `Stand vor ${officialAge} min`
            : "Stand unbekannt"
        }
      >
        {official.isLoading && <Skeleton className="h-20 w-full" />}
        {!official.isLoading && (official.data?.length ?? 0) === 0 && (
          <EmptyState
            title="Aktuell keine amtlichen Warnungen"
            description="Nichts vom DWD im Gebiet. Wir aktualisieren regelmäßig im Hintergrund."
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        )}
        <GroupedAlerts
          alerts={official.data ?? []}
          renderItem={(a) => (
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
          )}
        />
      </DataCard>

      <DataCard
        title="Eigene Schwellen-Analyse (DWD-orientiert)"
        subtitle={
          forecastAge != null
            ? `Aus Forecast der nächsten 48 h · Stand vor ${forecastAge} min`
            : "Aus Forecast der nächsten 48 h"
        }
      >
        {forecast.isLoading && <Skeleton className="h-20 w-full" />}
        {derived.length === 0 && !forecast.isLoading && (
          <EmptyState
            title="Keine Schwelle ausgelöst"
            description="Forecast bleibt innerhalb der DWD-orientierten Werte."
            icon={<ShieldAlert className="h-5 w-5" />}
          />
        )}
        <GroupedAlerts
          alerts={derived}
          renderItem={(d) => (
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
          )}
        />
      </DataCard>
    </div>
  );
}

/* ---------------- Gruppierung nach Stufe ---------------- */

interface GroupedAlertsProps<T extends { severity: AlertSeverity }> {
  alerts: T[];
  renderItem: (a: T) => ReactNode;
}

function GroupedAlerts<T extends { severity: AlertSeverity }>({
  alerts,
  renderItem,
}: GroupedAlertsProps<T>) {
  if (alerts.length === 0) return null;
  const order: SeverityLevel[] = [4, 3, 2, 1];
  const groups = order
    .map((lvl) => ({
      level: lvl,
      items: [...alerts]
        .filter((a) => alertSeverityToLevel(a.severity) === lvl)
        .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.level} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <SeverityRail level={g.level} orientation="horizontal" showLabel={false} className="w-10" />
            <span>
              {`Stufe ${g.level} · ${WARN_LEVEL[g.level].name}`} · {g.items.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">{g.items.map((a) => renderItem(a))}</div>
        </div>
      ))}
    </div>
  );
}

// AlertsPage konsumiert Bright-Sky-Daten als `WeatherAlert`-Liste.
export type { WeatherAlert };
