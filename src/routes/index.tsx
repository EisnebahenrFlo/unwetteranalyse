import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { brightSkyAlertsQuery, brightSkyCurrentQuery, forecastQuery } from "@/lib/weather/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { deriveAlertsFromForecast, derivedToAlert } from "@/lib/weather/analysis/situation";
import { useLiveNow } from "@/hooks/use-live-now";
import { liveDaily, liveHourly } from "@/lib/weather/live";
import { StickySubnav } from "@/components/cockpit/StickySubnav";
import { SectionHeader } from "@/components/cockpit/SectionHeader";
import { SituationHeadline } from "@/components/cockpit/SituationHeadline";
import { HazardPriorityList } from "@/components/cockpit/HazardPriorityList";
import { ShortTermPanel } from "@/components/cockpit/ShortTermPanel";
import { LiveSignals } from "@/components/cockpit/LiveSignals";
import { TrendStrip } from "@/components/cockpit/TrendStrip";
import { SystemStatus, type SourceEntry } from "@/components/cockpit/SystemStatus";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cockpit — MeteoFlo" },
      { name: "description", content: "Internes Analyse-Cockpit: Lage, Gefahren, Kurzfrist, Live-Signale, Trend und Systemstatus." },
    ],
  }),
  component: Dashboard,
});

const SECTIONS = [
  { id: "lage",     label: "Lage" },
  { id: "gefahren", label: "Gefahren" },
  { id: "nowcast",  label: "Nowcast" },
  { id: "live",     label: "Live" },
  { id: "trend",    label: "Trend" },
  { id: "system",   label: "System" },
];

function Dashboard() {
  const point = useActivePoint();
  const now = useLiveNow();
  const forecast = useQuery(forecastQuery(point));
  const bsCurrent = useQuery(brightSkyCurrentQuery(point));
  const bsAlerts = useQuery(brightSkyAlertsQuery(point));

  if (forecast.isLoading) return <DashboardSkeleton />;
  if (forecast.error || !forecast.data) {
    return <ErrorState message={forecast.error?.message ?? "Forecast nicht verfügbar."} onRetry={() => forecast.refetch()} />;
  }

  const bundle = {
    ...forecast.data,
    hourly: liveHourly(forecast.data.hourly, now),
    daily: liveDaily(forecast.data.daily, now),
  };
  const officialAlerts = bsAlerts.data ?? [];
  const derived = deriveAlertsFromForecast(bundle).map(derivedToAlert);

  const bsMeta = bsCurrent.data
    ? { source: "bright-sky" as const, updatedAt: bsCurrent.data.observedAt, resolutionKm: 1, uncertainty: "Punktwert der nächsten DWD-Station." }
    : bundle.meta;

  const sources: SourceEntry[] = [
    {
      id: "om",
      label: "Open-Meteo · Modell-Forecast",
      description: "Stündliche Modelldaten inkl. CAPE, LI, Wind, Niederschlag.",
      meta: bundle.meta,
      ok: true,
    },
    {
      id: "bs-current",
      label: "Bright Sky / DWD · Beobachtung",
      description: "Aktuelle Punktwerte der nächsten DWD-Station.",
      meta: bsCurrent.data ? bsMeta : undefined,
      ok: !!bsCurrent.data,
      note: bsCurrent.data ? undefined : "Keine Beobachtung verfügbar",
    },
    {
      id: "bs-alerts",
      label: "Bright Sky / DWD · Warnungen",
      description: "Amtliche Unwetterwarnungen für das Gebiet.",
      meta: bsAlerts.data ? { source: "bright-sky", updatedAt: new Date().toISOString() } : undefined,
      ok: bsAlerts.data != null,
      note: officialAlerts.length === 0 ? "Keine aktiven Warnungen" : `${officialAlerts.length} aktiv`,
    },
    {
      id: "dwd-radar",
      label: "DWD · Radarkomposit",
      description: "Animiertes Niederschlagsechobild über Deutschland.",
      meta: { source: "dwd", updatedAt: new Date().toISOString(), resolutionKm: 1 },
      ok: true,
    },
    {
      id: "rules",
      label: "DWD · Eigene Schwellen",
      description: `${derived.length} abgeleitete Hinweise aus Forecast-Schwellen.`,
      meta: { source: "dwd", updatedAt: bundle.meta.updatedAt },
      ok: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <StickySubnav items={SECTIONS} />

      {/* 1. Lage */}
      <section className="flex flex-col gap-3">
        <SectionHeader id="lage" eyebrow="01 · Lage" title="Gesamtlage"
          question="Was ist gerade los, wo liegt die Hauptgefahr, wie relevant?" />
        <SituationHeadline bundle={bundle} officialAlerts={officialAlerts} />
      </section>

      {/* 2. Gefahren */}
      <section className="flex flex-col gap-3">
        <SectionHeader id="gefahren" eyebrow="02 · Gefahren" title="Gefahrenbewertung"
          question="Welche Risiken sind priorisiert relevant, mit welcher Konfidenz?" />
        <HazardPriorityList bundle={bundle} officialAlerts={officialAlerts} />
      </section>

      {/* 3. Kurzfrist */}
      <section className="flex flex-col gap-3">
        <SectionHeader id="nowcast" eyebrow="03 · Nowcast" title="Kurzfrist 0–2 Stunden"
          question="Verschärft sich die Lage, entspannt sie sich, verlagert sie sich?" />
        <ShortTermPanel bundle={bundle} />
      </section>

      {/* 4. Live */}
      <section className="flex flex-col gap-3">
        <SectionHeader id="live" eyebrow="04 · Live" title="Live-Signale"
          question="Was bestätigen Radar und Beobachtung gerade?" />
        <LiveSignals point={point} bundle={bundle} bsCurrent={bsCurrent.data} bsMeta={bsMeta} />
      </section>

      {/* 5. Trend */}
      <section className="flex flex-col gap-3">
        <SectionHeader id="trend" eyebrow="05 · Trend" title="Trend & Ausblick"
          question="Wie entwickelt sich die Lage über die nächsten Stunden und Tage?" />
        <TrendStrip bundle={bundle} />
      </section>

      {/* 6. System */}
      <section className="flex flex-col gap-3">
        <SectionHeader id="system" eyebrow="06 · System" title="Datenstatus & Quellen"
          question="Welche Quellen liefern aktuell, wo gibt es Verzögerungen oder Lücken?" />
        <SystemStatus entries={sources} />
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
