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
import {
  thunderProbability, hailRisk, downburstRisk, lowLevelShearMs, sultriness,
  summarizeModelSevere,
} from "@/lib/weather/analysis/convection";
import { SevereTimeline } from "@/components/analysis/SevereTimeline";
import { useSettings } from "@/hooks/use-settings";
import { formatTemp } from "@/lib/weather/format";
import type { AlertSeverity, HourlyPoint } from "@/lib/weather/types";
import { useLiveNow } from "@/hooks/use-live-now";
import { liveHourly } from "@/lib/weather/live";

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
  const liveNow = useLiveNow();

  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  if (!q.data) return null;

  const hourly = liveHourly(q.data.hourly, liveNow);
  const conv = summarizeConvection(hourly);
  const winter = summarizeWinter(hourly);
  const sum = summarizeModelSevere(hourly);
  const now = hourly[0];
  const spread = now?.dewPointC != null ? now.temperatureC - now.dewPointC : null;

  // Peak-Stunde für Gewitter
  let peakTp = 0; let peakIdx = 0;
  hourly.slice(0, 24).forEach((p, i) => {
    const t = thunderProbability(p);
    if (t > peakTp) { peakTp = t; peakIdx = i; }
  });
  const peakHour = hourly[peakIdx];

  const shearNow = lowLevelShearMs(now);
  const sult = sultriness(now);

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Analyse</h1>
        <p className="text-xs text-muted-foreground">
          Abgeleitete Parameter und Unwetter-Einordnung für die nächsten 24 Stunden.
        </p>
      </div>

      {/* Severity-Score oben prominent */}
      <DataCard
        title="Unwetter-Score (24 h)"
        subtitle="Kombinierte Einordnung aus Gewitter, Hagel, Sturmböen, Starkregen."
        meta={q.data.meta}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-center gap-3">
            <div className="font-mono text-5xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-mono)" }}>
              {sum.worstScore}
            </div>
            {sum.level !== "none" && <WarnBadge severity={sum.level} />}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <KV label="Gewitter peak" value={`${Math.round(sum.thunderProbMax * 100)} %`} />
            <KV label="CAPE max" value={sum.capeMax != null ? `${sum.capeMax.toFixed(0)} J/kg` : "—"} />
            <KV label="LI min" value={sum.liMin != null ? sum.liMin.toFixed(1) : "—"} />
            <KV label="Böen max" value={`${(sum.gustMaxMs * 3.6).toFixed(0)} km/h`} />
          </div>
        </div>
      </DataCard>

      <SevereTimeline hourly={hourly} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <ParamCard
          title="Gewitter-Peak"
          info={{ title: "Gewitter-Wahrscheinlichkeit", text: "Heuristik aus CAPE, LI, CIN und WMO-Wettercode. Über 60 % als wahrscheinlich einordnen." }}
          big={`${Math.round(peakTp * 100)} %`}
          unit=""
          hint={peakHour ? `gegen ${new Date(peakHour.time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr` : undefined}
          level={peakTp >= 0.7 ? "severe" : peakTp >= 0.45 ? "moderate" : peakTp >= 0.25 ? "minor" : "none"}
        />
        <ParamCard
          title="Hagel-Risiko"
          info={{ title: "Hagel", text: "Hohes CAPE plus stark negativer LI plus tiefe Nullgradgrenze erhöhen das Hagelpotenzial deutlich." }}
          big={labelSeverity(peakRisk(hourly, hailRisk))}
          unit=""
        />
        <ParamCard
          title="Downburst / Sturm­böen"
          info={{ title: "Downburst", text: "Konvektion plus hohe Böen ergeben das Risiko für gefährliche Fallböen aus Gewittern." }}
          big={labelSeverity(peakRisk(hourly, downburstRisk))}
          unit=""
        />
        <ParamCard
          title="Konvektive Energie"
          info={{ title: "CAPE", text: "Convective Available Potential Energy. ≥ 500 mäßig, ≥ 1500 hoch, ≥ 2500 extrem." }}
          big={conv.capeMax != null ? conv.capeMax.toFixed(0) : "—"}
          unit="J/kg max"
          hint={conv.liMin != null ? `LI min ${conv.liMin.toFixed(1)}` : undefined}
          level={conv.level}
        />
        <ParamCard
          title="Low-Level Shear"
          info={{ title: "Wind­scherung 10 m → 180 m", text: "Höhenunterschied zwischen Wind in 10 m und 180 m. Höhere Werte begünstigen organisierte Gewitter." }}
          big={shearNow != null ? shearNow.toFixed(1) : "—"}
          unit="m/s"
          hint="0–4 schwach · 4–8 mäßig · > 8 stark"
        />
        <ParamCard
          title="Taupunkt & Schwüle"
          info={{ title: "Taupunkt", text: "Maß für absolute Feuchte. Über 16 °C wird es schwül, über 20 °C drückend." }}
          big={formatTemp(now?.dewPointC, settings.tempUnit)}
          unit={sult}
          hint={spread != null ? `Spread ${spread.toFixed(1)} K` : undefined}
        />
        <ParamCard
          title="Starkregen-Peak"
          info={{ title: "Starkregen", text: "DWD-Schwellen: ≥ 15 mm/h markant, ≥ 25 heftig, ≥ 40 extrem." }}
          big={sum.precipMaxMm.toFixed(1)}
          unit="mm/h"
        />
        <ParamCard
          title="Wind & Böen"
          info={{ title: "Böen", text: "≥ 50 km/h markant, ≥ 65 Sturmböen, ≥ 90 schwerer Sturm, ≥ 118 Orkan." }}
          big={`${(sum.gustMaxMs * 3.6).toFixed(0)}`}
          unit="km/h Spitze"
          hint={now?.windSpeedMs != null ? `Mittel jetzt ${(now.windSpeedMs * 3.6).toFixed(0)} km/h` : undefined}
        />
        <ParamCard
          title="Winter / Schnee"
          info={{ title: "Schneefallgrenze", text: "Liegt die Nullgradgrenze unter der Geländehöhe, fällt Niederschlag als Schnee." }}
          big={winter.snowfallSumCm > 0 ? winter.snowfallSumCm.toFixed(1) : "—"}
          unit="cm Neuschnee 24 h"
          hint={winter.freezingLevelMinM != null ? `0 °C bei ${Math.round(winter.freezingLevelMinM)} m` : undefined}
        />
      </div>
    </div>
  );
}

function ParamCard({
  title, info, big, unit, hint, level,
}: {
  title: string;
  info: { title: string; text: string };
  big: string;
  unit?: string;
  hint?: string;
  level?: AlertSeverity | "none";
}) {
  return (
    <DataCard
      title={title}
      action={<InfoPopover title={info.title}>{info.text}</InfoPopover>}
    >
      <div className="flex flex-col gap-2">
        <ValueWithUnit value={big} unit={unit} size="lg" hint={hint} />
        {level && level !== "none" && <WarnBadge severity={level} />}
      </div>
    </DataCard>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background/60 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm" style={{ fontFamily: "var(--font-mono)" }}>{value}</div>
    </div>
  );
}

function peakRisk(hourly: HourlyPoint[], fn: (p: HourlyPoint) => AlertSeverity | "none"): AlertSeverity | "none" {
  const order: Array<AlertSeverity | "none"> = ["none", "minor", "moderate", "severe", "extreme"];
  let worst: AlertSeverity | "none" = "none";
  for (const p of hourly.slice(0, 24)) {
    const r = fn(p);
    if (order.indexOf(r) > order.indexOf(worst)) worst = r;
  }
  return worst;
}

function labelSeverity(s: AlertSeverity | "none"): string {
  return s === "extreme" ? "Extrem" :
    s === "severe" ? "Hoch" :
    s === "moderate" ? "Erhöht" :
    s === "minor" ? "Gering" : "Keine";
}
