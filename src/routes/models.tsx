import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { modelComparisonQuery } from "@/lib/weather/queries";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useLiveNow } from "@/hooks/use-live-now";
import { buildConsensus, buildRanking, type ConsensusMetric } from "@/lib/weather/analysis/model-consensus";
import { ModelSummaryCard } from "@/components/models/ModelSummaryCard";
import { ConsensusPanel } from "@/components/models/ConsensusPanel";
import { ParameterFilterStrip, PARAMETERS } from "@/components/models/ParameterFilterStrip";
import { FocusedCompareChart } from "@/components/models/FocusedCompareChart";
import { ModelRiskRanking } from "@/components/models/ModelRiskRanking";
import { ModelTechDetails } from "@/components/models/ModelTechDetails";
import { DataMeta } from "@/components/common/DataMeta";

export const Route = createFileRoute("/models")({
  head: () => ({
    meta: [
      { title: "Modellvergleich — ForecastHub" },
      { name: "description", content: "ICON-D2, ICON-EU, ECMWF, GFS und AROME direkt nebeneinander." },
    ],
  }),
  component: ModelsPage,
});

function ModelsPage() {
  const point = useActivePoint();
  const q = useQuery(modelComparisonQuery(point));
  const [metric, setMetric] = useState<ConsensusMetric>("temperatureC");
  const now = useLiveNow();

  const series = q.data ?? [];
  const summary = useMemo(() => (series.length ? buildConsensus(series, now) : null), [series, now]);
  const ranking = useMemo(() => (series.length ? buildRanking(series, now) : []), [series, now]);
  const activeParam = PARAMETERS.find((p) => p.id === metric)!;

  return (
    <div className="flex flex-col gap-5">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight">Modelle · {point.name}</h1>
        <p className="truncate text-xs text-muted-foreground">
          Lage, Konsens und Modellvergleich für die nächsten 72 Stunden.
        </p>
      </div>

      {/* Block 1: Lagebox */}
      {q.isLoading && <Skeleton className="h-44 w-full" />}
      {q.error && <ErrorState message={q.error.message} onRetry={() => q.refetch()} />}
      {summary && <ModelSummaryCard summary={summary} updatedAt={series[0]?.meta.updatedAt} />}

      {/* Block 2: Konsens */}
      {summary && <ConsensusPanel summary={summary} />}

      {/* Block 3: Parameter-Filter (sticky) */}
      {series.length > 0 && <ParameterFilterStrip active={metric} onChange={setMetric} />}

      {/* Block 4: Fokussierter Modellvergleich */}
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight">Vergleich der Kernmodelle</h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{activeParam.label} · {activeParam.unit}</p>
        </div>
      </div>
        {q.isLoading && <Skeleton className="h-64 w-full" />}
        {series.length > 0 && <FocusedCompareChart series={series} metric={metric} unitLabel={activeParam.unit} />}
      </Card>

      {/* Block 5: Gewitter-Ranking */}
      {ranking.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">Gewitter & Unwetter nach Modell</h2>
            <span className="text-[11px] text-muted-foreground">24 h · sortiert nach Score</span>
          </div>
          <ModelRiskRanking rows={ranking} />
        </section>
      )}

      {/* Block 7: Technische Details */}
      <ModelTechDetails />

      {/* Block 8: Meta */}
      {series[0]?.meta && (
        <Card className="p-4">
          <DataMeta meta={series[0].meta} />
        </Card>
      )}
    </div>
  );
}
