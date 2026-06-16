import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { forecastQuery } from "@/lib/weather/queries";
import { DataCard } from "@/components/common/DataCard";
import { ValueWithUnit } from "@/components/common/ValueWithUnit";
import { InfoPopover } from "@/components/common/InfoPopover";
import { Skeleton } from "@/components/ui/skeleton";
import { WarnBadge } from "@/components/common/WarnBadge";
import { summarizeConvection, summarizeWinter } from "@/lib/weather/analysis/situation";
import { useSettings } from "@/hooks/use-settings";
import { formatTemp } from "@/lib/weather/format";

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Analyse — MeteoFlo" },
      { name: "description", content: "Interpretierte Wetterlage mit Konvektion, Winter und Taupunkt-Spread." },
    ],
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const point = useActivePoint();
  const q = useQuery(forecastQuery(point));
  const [settings] = useSettings();

  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  if (!q.data) return null;

  const conv = summarizeConvection(q.data.hourly);
  const winter = summarizeWinter(q.data.hourly);
  const now = q.data.hourly[0];
  const spread = now?.dewPointC != null ? now.temperatureC - now.dewPointC : null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Analyse</h1>
        <p className="text-xs text-muted-foreground">Abgeleitete Größen aus dem Forecast, ergänzt um eine einfache Einordnung.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <DataCard
          title="Konvektion"
          subtitle="nächste 24 h"
          action={<InfoPopover title="CAPE & Lifted Index">
            CAPE misst die verfügbare Energie für aufsteigende Luft. Der Lifted Index vergleicht ein aufsteigendes Luftpaket mit der Umgebung. Negative LI und hohe CAPE deuten auf labile Schichtung.
          </InfoPopover>}
          meta={q.data.meta}
        >
          <div className="flex flex-col gap-2">
            <ValueWithUnit value={conv.capeMax != null ? conv.capeMax.toFixed(0) : "—"} unit="J/kg CAPE max" size="lg" />
            <ValueWithUnit value={conv.liMin != null ? conv.liMin.toFixed(1) : "—"} unit="LI min" size="sm" />
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
              {conv.level !== "none" && <WarnBadge severity={conv.level} />}
              <p className="min-w-0 text-xs text-muted-foreground">{conv.text}</p>
            </div>
          </div>
        </DataCard>

        <DataCard
          title="Winter"
          subtitle="nächste 24 h"
          action={<InfoPopover title="Schneefall & Nullgradgrenze">
            Die Nullgradgrenze (Freezing Level) ist die Höhe, in der die Temperatur 0 °C erreicht. Liegt sie unter der Geländehöhe, fällt Niederschlag als Schnee.
          </InfoPopover>}
          meta={q.data.meta}
        >
          <div className="flex flex-col gap-2">
            <ValueWithUnit value={winter.snowfallSumCm.toFixed(1)} unit="cm Neuschnee" size="lg" />
            <ValueWithUnit
              value={winter.freezingLevelMinM != null ? winter.freezingLevelMinM.toFixed(0) : "—"}
              unit="m Nullgradgrenze (min)"
              size="sm"
            />
            <p className="text-xs text-muted-foreground">{winter.text}</p>
          </div>
        </DataCard>

        <DataCard
          title="Taupunkt-Spread"
          subtitle="aktuell"
          action={<InfoPopover title="Taupunkt-Spread">
            Differenz zwischen Lufttemperatur und Taupunkt. Werte unter 2 K bedeuten hohe Sättigung, Nebelgefahr; große Werte sprechen für trockene Luft.
          </InfoPopover>}
          meta={q.data.meta}
        >
          <ValueWithUnit value={spread != null ? spread.toFixed(1) : "—"} unit="K Spread" size="lg" />
          <div className="mt-2 text-xs text-muted-foreground">
            Temp {formatTemp(now?.temperatureC, settings.tempUnit)} · Taupunkt {formatTemp(now?.dewPointC, settings.tempUnit)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {spread == null ? "Keine Daten." :
              spread < 2 ? "Hohe Sättigung, Nebel oder Tau möglich." :
              spread < 5 ? "Feuchte Luft, Wolken/Schauer begünstigt." :
              "Trockene Luft, geringe Wolkenbildung."}
          </p>
        </DataCard>
      </div>
    </div>
  );
}
