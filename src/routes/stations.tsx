import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { brightSkyStationsQuery } from "@/lib/weather/queries";
import { useSettings } from "@/hooks/use-settings";
import { formatTemp, formatWind, formatRelative } from "@/lib/weather/format";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Radio } from "lucide-react";
import { useLiveNow } from "@/hooks/use-live-now";

export const Route = createFileRoute("/stations")({
  head: () => ({
    meta: [
      { title: "Stationsdaten — ForecastHub" },
      { name: "description", content: "Aktuelle Beobachtungen von DWD-Stationen im Umkreis." },
    ],
  }),
  component: StationsPage,
});

function StationsPage() {
  const point = useActivePoint();
  const q = useQuery(brightSkyStationsQuery(point));
  const [settings] = useSettings();
  useLiveNow();

  const stations = q.data ?? [];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Stationen</h1>
        <p className="text-sm text-muted-foreground">DWD Messstationen im 50 km Umkreis</p>
        {q.data && (
          <p className="text-xs text-muted-foreground/80">{stations.length} Stationen gefunden</p>
        )}
      </header>

      {q.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      )}

      {!q.isLoading && stations.length === 0 && (
        <EmptyState
          title="Keine Stationsdaten im Umkreis"
          description="Außerhalb der DWD Abdeckung (z. B. in Italien) liefert Bright Sky keine Stationen."
          icon={<Radio className="h-5 w-5" />}
        />
      )}

      <ul className="flex flex-col gap-3">
        {stations.map((s) => (
          <li
            key={`${s.stationId}-${s.observedAt}`}
            className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:bg-accent/30"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="line-clamp-2 text-sm font-semibold uppercase tracking-wide text-foreground">
                {s.stationName}
              </h2>
              <span className="shrink-0 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {s.distanceKm.toFixed(1).replace(".", ",")} km
              </span>
            </div>

            <div className="mt-3 text-4xl font-semibold tracking-tight tabular-nums text-foreground">
              {formatTemp(s.temperatureC, settings.tempUnit)}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/30 p-3">
              <StationMetric label="Taupunkt" value={formatTemp(s.dewPointC, settings.tempUnit)} />
              <StationMetric label="Wind" value={formatWind(s.windSpeedMs, settings.windUnit)} />
              <StationMetric label="Böen" value={formatWind(s.windGustMs, settings.windUnit)} />
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground/80">
              ID {s.stationId} · Aktualisiert {formatRelative(s.observedAt)}
            </p>
          </li>
        ))}
      </ul>

      {stations.length > 0 && (
        <p className="pt-2 text-center text-[11px] text-muted-foreground/70">
          Quelle: Bright Sky / DWD · Auflösung ca. 1 km
        </p>
      )}
    </div>
  );
}

function StationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 text-center">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}
