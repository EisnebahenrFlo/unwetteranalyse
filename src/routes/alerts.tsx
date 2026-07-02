import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { weatherAlertsQuery, forecastQuery } from "@/lib/weather/queries";
import { DataCard } from "@/components/common/DataCard";
import {
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
import { cn } from "@/lib/utils";

const LEVEL_BG: Record<SeverityLevel, string> = {
  1: "bg-warn-minor",
  2: "bg-warn-moderate",
  3: "bg-warn-severe",
  4: "bg-warn-extreme",
};
const LEVEL_BORDER: Record<SeverityLevel, string> = {
  1: "border-l-warn-minor",
  2: "border-l-warn-moderate",
  3: "border-l-warn-severe",
  4: "border-l-warn-extreme",
};

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
  const official = useQuery(weatherAlertsQuery(point));
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
          Offizielle Warnungen aus DWD (Deutschland via Bright Sky) und MeteoAlarm
          (AT/CH/IT) plus eigene Schwellen aus der Forecast-Analyse.
        </p>
      </header>

      <DataCard
        title={
          (official.data ?? []).some((a) => a.source === "meteoalarm")
            ? "Offizielle Warnungen (MeteoAlarm)"
            : "Offizielle Warnungen (DWD / Bright Sky)"
        }
        subtitle={
          officialAge != null
            ? <>Stand vor <span className="font-mono tabular-nums">{officialAge}</span> min</>
            : "Stand unbekannt"
        }
      >
        {official.isLoading && <Skeleton className="h-20 w-full" />}
        {!official.isLoading && (official.data?.length ?? 0) === 0 && (
          <EmptyState
            title="Aktuell keine amtlichen Warnungen"
            description="Nichts Amtliches im Gebiet. Wir aktualisieren regelmäßig im Hintergrund."
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        )}
        <GroupedAlerts
          alerts={official.data ?? []}
          renderItem={(a) => (
            <AlertCard
              key={a.id}
              severity={a.severity}
              headline={a.headline}
              timeLine={
                <>
                  <span className="font-mono tabular-nums">{formatHour(a.onset)}</span> bis{" "}
                  <span className="font-mono tabular-nums">{formatHour(a.expires)}</span> ·{" "}
                  {formatRelative(a.onset)}
                  {a.area ? <> · <span className="text-foreground/80">{a.area}</span></> : null}
                </>
              }
              description={a.description}
              instruction={a.instruction}
              descriptionClassName="whitespace-pre-line"
            />
          )}
        />
        {(official.data ?? []).some((a) => a.source === "meteoalarm") && (
          <p className="mt-3 text-[10px] text-muted-foreground">
            Quelle: MeteoAlarm (EUMETNET), CC BY 4.0.
          </p>
        )}
      </DataCard>

      <DataCard
        title="Eigene Schwellen-Analyse (DWD-orientiert)"
        subtitle={
          forecastAge != null
            ? <>Aus Forecast der nächsten 48 h · Stand vor <span className="font-mono tabular-nums">{forecastAge}</span> min</>
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
            <AlertCard
              key={d.id}
              severity={d.severity}
              headline={d.headline}
              timeLine={
                <>
                  erstmals erwartet{" "}
                  <span className="font-mono tabular-nums">{formatHour(d.onset)}</span> ·{" "}
                  {formatRelative(d.onset)}
                </>
              }
              description={d.description}
              instruction={d.instruction}
            />
          )}
        />
      </DataCard>
    </div>
  );
}

/* ---------------- Einzelne Alert-Karte ---------------- */

interface AlertCardProps {
  severity: AlertSeverity;
  headline: string;
  timeLine: ReactNode;
  description?: string;
  instruction?: string;
  descriptionClassName?: string;
}

function AlertCard({
  severity,
  headline,
  timeLine,
  description,
  instruction,
  descriptionClassName,
}: AlertCardProps) {
  const lvl = alertSeverityToLevel(severity);
  return (
    <article
      className={cn(
        "rounded-md border border-border border-l-[3px] bg-background/50 p-3",
        LEVEL_BORDER[lvl],
      )}
    >
      <header className="min-w-0">
        <h3 className="font-display text-sm font-semibold leading-snug text-foreground">
          {headline}
        </h3>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{timeLine}</div>
      </header>
      {description && (
        <p
          className={cn(
            "mt-2 text-xs leading-relaxed text-foreground/90",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      )}
      {instruction && (
        <p className="mt-2 rounded bg-muted px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {instruction}
        </p>
      )}
    </article>
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
        <section key={g.level} className="flex flex-col gap-2.5">
          <header className="flex items-center gap-2 border-b border-border/60 pb-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span
              className={cn("h-3 w-3 shrink-0 rounded-[3px]", LEVEL_BG[g.level])}
              aria-hidden
            />
            <span className="font-display font-semibold tracking-[0.18em] text-foreground/90">
              Stufe {g.level} · {WARN_LEVEL[g.level].name}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">
              · {g.items.length}
            </span>
          </header>
          <div className="flex flex-col gap-2.5">{g.items.map((a) => renderItem(a))}</div>
        </section>
      ))}
    </div>
  );
}

// AlertsPage konsumiert Bright-Sky-Daten als `WeatherAlert`-Liste.
export type { WeatherAlert };
