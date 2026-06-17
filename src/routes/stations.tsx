import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { brightSkyStationsQuery } from "@/lib/weather/queries";
import { DataCard } from "@/components/common/DataCard";
import { useSettings } from "@/hooks/use-settings";
import { formatTemp, formatWind, formatPressure, formatPrecip, formatRelative } from "@/lib/weather/format";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Radio } from "lucide-react";
import { useLiveNow } from "@/hooks/use-live-now";

export const Route = createFileRoute("/stations")({
  head: () => ({
    meta: [
      { title: "Stationsdaten — MeteoFlo" },
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

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Stationen</h1>
        <p className="text-xs text-muted-foreground">DWD-Stationen im 50-km-Umkreis (via Bright Sky). Außerhalb Deutschlands meist leer.</p>
      </div>
      <DataCard
        title="Beobachtungen"
        subtitle={q.data ? `${q.data.length} Stationen` : undefined}
        meta={q.data?.[0] ? { source: "bright-sky", updatedAt: q.data[0].observedAt, resolutionKm: 1 } : undefined}
      >
        {q.isLoading && <Skeleton className="h-40 w-full" />}
        {!q.isLoading && (q.data?.length ?? 0) === 0 && (
          <EmptyState title="Keine Stationsdaten im Umkreis" description="Außerhalb der DWD-Abdeckung (z. B. in Italien) liefert Bright Sky keine Stationen." icon={<Radio className="h-5 w-5" />} />
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3">Station</th>
                <th className="py-1.5 pr-3">Distanz</th>
                <th className="py-1.5 pr-3">Temp</th>
                <th className="py-1.5 pr-3">Taupunkt</th>
                <th className="py-1.5 pr-3">Wind</th>
                <th className="py-1.5 pr-3">Böen</th>
                <th className="py-1.5 pr-3">Druck</th>
                <th className="py-1.5 pr-3">Niederschlag</th>
                <th className="py-1.5 pr-3">Stand</th>
              </tr>
            </thead>
            <tbody className="font-mono" style={{ fontFamily: "var(--font-mono)" }}>
              {q.data?.map((s) => (
                <tr key={s.stationId} className="border-t border-border/50">
                  <td className="py-1.5 pr-3">
                    <div className="font-sans text-foreground">{s.stationName}</div>
                    <div className="font-sans text-[10px] text-muted-foreground">ID {s.stationId}</div>
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{s.distanceKm.toFixed(1)} km</td>
                  <td className="py-1.5 pr-3">{formatTemp(s.temperatureC, settings.tempUnit)}</td>
                  <td className="py-1.5 pr-3">{formatTemp(s.dewPointC, settings.tempUnit)}</td>
                  <td className="py-1.5 pr-3">{formatWind(s.windSpeedMs, settings.windUnit)}</td>
                  <td className="py-1.5 pr-3">{formatWind(s.windGustMs, settings.windUnit)}</td>
                  <td className="py-1.5 pr-3">{formatPressure(s.pressureHpa)}</td>
                  <td className="py-1.5 pr-3">{formatPrecip(s.precipitationMm)}</td>
                  <td className="py-1.5 pr-3 font-sans text-[10px] text-muted-foreground">{formatRelative(s.observedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
