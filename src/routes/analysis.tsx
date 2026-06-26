import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { forecastQuery } from "@/lib/weather/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedTabs } from "@/components/common/SegmentedTabs";
import { DataCard } from "@/components/common/DataCard";
import { useLiveNow } from "@/hooks/use-live-now";
import { liveHourly } from "@/lib/weather/live";
import { buildNowcast } from "@/lib/weather/scoring/nowcast";
import { buildToday } from "@/lib/weather/scoring/today";
import { deriveAll, thunderProbability } from "@/lib/weather/scoring/derived";
import { normCape } from "@/lib/weather/scoring/normalize";
import { ScoreHeadline } from "@/components/analysis/ScoreHeadline";
import { SubscoreBars } from "@/components/analysis/SubscoreBars";
import { NowcastTable } from "@/components/analysis/NowcastTable";
import { ScoreExplainPanel } from "@/components/analysis/ScoreExplainPanel";
import { DataStatusStrip, type DataStatus } from "@/components/analysis/DataStatusStrip";
import { ParamCardPro } from "@/components/analysis/ParamCardPro";
import { SevereTimeline } from "@/components/analysis/SevereTimeline";
import { bandFromScore } from "@/lib/weather/scoring/labels";
import { useStormSnapshot } from "@/lib/weather/storm/use-storm-tracking";

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Analyse — ForecastHub" },
      {
        name: "description",
        content: "Nachvollziehbare Wetterbewertung in drei Ebenen: Nowcast, Tag, Parameter.",
      },
    ],
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const point = useActivePoint();
  const q = useQuery(forecastQuery(point));
  const now = useLiveNow();
  const storm = useStormSnapshot();
  const [tab, setTab] = useState<"nowcast" | "today" | "params">("nowcast");

  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  if (!q.data) return null;

  const bundle = q.data;
  const hourlyLive = liveHourly(bundle.hourly, now);

  const liveObsAgeMinutes = bundle.current
    ? Math.max(0, (now.getTime() - new Date(bundle.current.observedAt).getTime()) / 60_000)
    : null;
  const modelObsConsistent: boolean | null = (() => {
    if (!bundle.current || hourlyLive.length === 0) return null;
    const dT = Math.abs(bundle.current.temperatureC - hourlyLive[0].temperatureC);
    return dT <= 3;
  })();

  const radarTopDbz = storm.cells.reduce((m, c) => Math.max(m, c.topDbz), 0) || null;
  const radarAgeMinutes = storm.lastFrameTime
    ? Math.round((Date.now() - new Date(storm.lastFrameTime).getTime()) / 60_000)
    : null;

  const forecastAgeMinutes = bundle.meta?.updatedAt
    ? Math.max(0, (now.getTime() - new Date(bundle.meta.updatedAt).getTime()) / 60_000)
    : null;

  const nowcast = buildNowcast({
    hourly: bundle.hourly,
    minutely: bundle.minutely,
    now,
    radarTopDbz,
    radarAgeMinutes,
    liveObsAgeMinutes,
    modelObsConsistent,
  });

  const today = buildToday({
    hourly: hourlyLive,
    liveObsAgeMinutes,
    radarAgeMinutes,
    modelObsConsistent,
  });

  const dataStatus: DataStatus[] = [
    {
      label: "Forecast",
      source: "Open-Meteo",
      ageMinutes: forecastAgeMinutes,
      ok: forecastAgeMinutes == null || forecastAgeMinutes <= 180,
    },
    {
      label: "Beobachtung",
      source: bundle.current ? "Open-Meteo Current" : "—",
      ageMinutes: liveObsAgeMinutes,
      ok: liveObsAgeMinutes != null && liveObsAgeMinutes <= 120,
    },
    {
      label: "Stormtrack",
      source: "DWD RY",
      ageMinutes: radarAgeMinutes,
      ok: radarAgeMinutes != null && radarAgeMinutes <= 15,
      note: `${storm.cells.length} Zelle${storm.cells.length === 1 ? "" : "n"}`,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 md:gap-8">
      <header className="flex flex-col gap-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Analyse
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          Bewertung in drei Ebenen
        </h1>
        <p className="text-sm text-muted-foreground">
          Nowcast 0–2 h · Heute 0–24 h · Parameter. Jeder Score ist nachvollziehbar.
        </p>
      </header>

      <SegmentedTabs<"nowcast" | "today" | "params">
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "nowcast", label: "Nowcast 0–2 h" },
          { id: "today", label: "Heute 0–24 h" },
          { id: "params", label: "Parameter" },
        ]}
      />

      {tab === "nowcast" && (
        <div className="flex flex-col gap-3">
          <ScoreHeadline
            score={nowcast.total}
            band={nowcast.band}
            headline={headlineFor(nowcast.band, nowcast.reasons)}
            peakLabel={nowcast.peakAt ? `+${nowcast.peakMinutes} min` : undefined}
            confidence={nowcast.confidence}
            dataConfidence={nowcast.data.value}
            footer="0–2 h: Niederschlag, Wind, Gewitter und Radar-Echo haben das höchste Gewicht."
          />
          <DataCard
            title="Teilrisiken"
            subtitle="Vier Bewertungsachsen, je 0–100, mit den stärksten Beiträgen."
          >
            <SubscoreBars subs={nowcast.subs} />
          </DataCard>
          <DataCard
            title="Zeitachse 0–2 h"
            subtitle="10-Minuten-Schritte mit Regen, Wind, Score und Confidence."
          >
            <NowcastTable steps={nowcast.steps} daily={bundle.daily} />
          </DataCard>
          <ScoreExplainPanel subs={nowcast.subs} data={nowcast.data} reasons={nowcast.reasons} />
          <DataCard title="Datenstatus" subtitle="Sichtbare Quellen, Frische und Verbindung.">
            <DataStatusStrip items={dataStatus} />
          </DataCard>
        </div>
      )}

      {tab === "today" && (
        <div className="flex flex-col gap-3">
          <ScoreHeadline
            score={today.total}
            band={today.band}
            headline={headlineFor(today.band, today.reasons)}
            peakLabel={
              today.peakWindow
                ? formatWindow(today.peakWindow.startAt, today.peakWindow.endAt)
                : undefined
            }
            confidence={today.confidence}
            dataConfidence={today.data.value}
            footer="0–24 h: CAPE, LI, Gewitterwahrscheinlichkeit, Niederschlag und Böen haben das höchste Gewicht."
          />
          <DataCard
            title="Teilrisiken (Tagesmaximum)"
            subtitle="Stärkste Stundenbewertung pro Achse."
          >
            <SubscoreBars subs={today.subs} />
          </DataCard>
          <SevereTimeline hourly={hourlyLive} />
          <ScoreExplainPanel subs={today.subs} data={today.data} reasons={today.reasons} />
          <DataCard title="Datenstatus" subtitle="Sichtbare Quellen, Frische und Verbindung.">
            <DataStatusStrip items={dataStatus} />
          </DataCard>
        </div>
      )}

      {tab === "params" && <ParamGrid />}
    </div>
  );

  function ParamGrid() {
    const nowPoint = hourlyLive[0];
    if (!nowPoint) return null;
    const d = deriveAll(nowPoint);
    const tp = thunderProbability(nowPoint);
    const spreadStr = d.dewPointSpreadK != null ? `${d.dewPointSpreadK.toFixed(1)} K` : "—";
    const cape = nowPoint.cape;
    const li = nowPoint.liftedIndex;
    const cin = nowPoint.convectiveInhibition;
    const gustKmh = nowPoint.windGustMs != null ? nowPoint.windGustMs * 3.6 : null;
    const windKmh = nowPoint.windSpeedMs != null ? nowPoint.windSpeedMs * 3.6 : null;

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <ParamCardPro
          title="Temperatur / Taupunkt"
          value={`${nowPoint.temperatureC.toFixed(1)} °C`}
          unit={`Td ${nowPoint.dewPointC != null ? nowPoint.dewPointC.toFixed(1) + " °C" : "—"}`}
          derived={{ label: "Spread", value: spreadStr }}
          interpretation={`Schwüle: ${d.sultriness}`}
        />
        <ParamCardPro
          title="Wind & Böen"
          value={windKmh != null ? windKmh.toFixed(0) : "—"}
          unit="km/h Mittel"
          derived={{ label: "Spitze", value: gustKmh != null ? `${gustKmh.toFixed(0)} km/h` : "—" }}
        />
        <ParamCardPro
          title="Niederschlag"
          value={nowPoint.precipitationMm != null ? nowPoint.precipitationMm.toFixed(1) : "—"}
          unit="mm/h jetzt"
          derived={{
            label: "Wahrscheinlichkeit",
            value:
              nowPoint.precipitationProbability != null
                ? `${nowPoint.precipitationProbability.toFixed(0)} %`
                : "—",
          }}
        />
        <ParamCardPro
          title="CAPE / LI / CIN"
          value={cape != null ? cape.toFixed(0) : "—"}
          unit="J/kg CAPE"
          derived={{
            label: "LI / CIN",
            value: `${li != null ? li.toFixed(1) : "—"} / ${cin != null ? cin.toFixed(0) : "—"}`,
          }}
          band={cape != null ? bandFromScore(Math.min(75, normCape(cape))) : undefined}
        />
        <ParamCardPro
          title="Gewitterwahrscheinlichkeit"
          value={`${Math.round(tp * 100)} %`}
          unit="heuristisch"
        />
        <ParamCardPro
          title="Wolken / Sicht / UV"
          value={`${nowPoint.cloudCover != null ? nowPoint.cloudCover.toFixed(0) : "—"} %`}
          unit="Bedeckung"
          derived={{
            label: "Sicht / UV",
            value: `${nowPoint.visibilityM != null ? (nowPoint.visibilityM / 1000).toFixed(1) + " km" : "—"} / ${nowPoint.uvIndex != null ? nowPoint.uvIndex.toFixed(0) : "—"}`,
          }}
        />
      </div>
    );
  }
}

function headlineFor(band: ReturnType<typeof bandFromScore>, reasons: string[]): string {
  switch (band) {
    case "hochkritisch":
      return "Hochkritische Wetterlage";
    case "kritisch":
      return "Kritische Entwicklung";
    case "markant":
      return "Markante Signale";
    case "aufmerksam":
      return reasons[0] === "keine Signale über Schwelle"
        ? "Beobachtungslage"
        : "Aufmerksam beobachten";
    default:
      return "Ruhige Lage";
  }
}

function formatWindow(a: string, b: string): string {
  const f = (iso: string) =>
    new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${f(a)}–${f(b)}`;
}