import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { modelComparisonQuery } from "@/lib/weather/queries";
import { DataCard } from "@/components/common/DataCard";
import { ModelCompareChart } from "@/components/models/ModelCompareChart";
import { ModelSeverityGrid } from "@/components/models/ModelSeverityGrid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { InfoPopover } from "@/components/common/InfoPopover";
import { WEATHER_MODELS } from "@/lib/weather/models";

export const Route = createFileRoute("/models")({
  head: () => ({
    meta: [
      { title: "Modellvergleich — MeteoFlo" },
      { name: "description", content: "ICON-D2, ICON-EU, ECMWF, GFS und AROME direkt nebeneinander." },
    ],
  }),
  component: ModelsPage,
});

type Metric = "temperatureC" | "precipitationMm" | "windGustMs";

const METRICS: Record<Metric, { label: string; unit: string }> = {
  temperatureC: { label: "Temperatur", unit: "°C" },
  precipitationMm: { label: "Niederschlag", unit: "mm/h" },
  windGustMs: { label: "Böen", unit: "m/s" },
};

function ModelsPage() {
  const point = useActivePoint();
  const q = useQuery(modelComparisonQuery(point));
  const [metric, setMetric] = useState<Metric>("temperatureC");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">Modellvergleich</h1>
          <p className="truncate text-xs text-muted-foreground">
            72-Stunden-Horizont aus Open-Meteo. Modell-Spread zeigt Unsicherheit.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {(Object.keys(METRICS) as Metric[]).map((m) => (
            <Button key={m} size="sm" variant={metric === m ? "default" : "outline"} onClick={() => setMetric(m)}>
              {METRICS[m].label}
            </Button>
          ))}
        </div>
      </div>

      <DataCard
        title={`Modellvergleich · ${METRICS[metric].label}`}
        action={<InfoPopover title="Modell-Spread">
          Verschiedene Modelle liefern oft unterschiedliche Werte. Je weiter die Linien auseinander liegen, desto unsicherer ist die Prognose.
        </InfoPopover>}
        meta={q.data?.[0]?.meta}
      >
        {q.isLoading && <Skeleton className="h-72 w-full" />}
        {q.error && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
        {q.data && <ModelCompareChart series={q.data} metric={metric} unitLabel={METRICS[metric].unit} />}
      </DataCard>

      {q.data && <ModelSeverityGrid series={q.data} />}

      <DataCard title="Verfügbare Modelle">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3">Modell</th>
                <th className="py-1.5 pr-3">Anbieter</th>
                <th className="py-1.5 pr-3">Auflösung</th>
                <th className="py-1.5 pr-3">Region</th>
                <th className="py-1.5 pr-3">Horizont</th>
              </tr>
            </thead>
            <tbody>
              {WEATHER_MODELS.map((m) => (
                <tr key={m.id} className="border-t border-border/50">
                  <td className="py-1.5 pr-3 font-medium">{m.label}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{m.provider}</td>
                  <td className="py-1.5 pr-3 font-mono" style={{ fontFamily: "var(--font-mono)" }}>{m.resolutionKm} km</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{m.region}</td>
                  <td className="py-1.5 pr-3 font-mono" style={{ fontFamily: "var(--font-mono)" }}>{m.horizonHours} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
