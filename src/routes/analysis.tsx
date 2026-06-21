import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { forecastQuery } from "@/lib/weather/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedTabs } from "@/components/common/SegmentedTabs";
import { DataCard } from "@/components/common/DataCard";
import { useLiveNow } from "@/hooks/use-live-now";
import { useLightningStream } from "@/lib/weather/sources/blitzortung";
import { liveHourly } from "@/lib/weather/live";
import { buildNowcast } from "@/lib/weather/scoring/nowcast";
import { buildToday } from "@/lib/weather/scoring/today";
import { deriveAll, thunderProbability } from "@/lib/weather/scoring/derived";
import { ScoreHeadline } from "@/components/analysis/ScoreHeadline";
import { SubscoreBars } from "@/components/analysis/SubscoreBars";
import { NowcastTable } from "@/components/analysis/NowcastTable";
import { ScoreExplainPanel } from "@/components/analysis/ScoreExplainPanel";
import { DataStatusStrip, type DataStatus } from "@/components/analysis/DataStatusStrip";
import { ParamCardPro } from "@/components/analysis/ParamCardPro";
import { SevereTimeline } from "@/components/analysis/SevereTimeline";
import { bandFromScore } from "@/lib/weather/scoring/labels";

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Analyse — MeteoFlo" },
      { name: "description", content: "Nachvollziehbare Wetterbewertung in drei Ebenen: Nowcast, Tag, Parameter." },
    ],
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const point = useActivePoint();
  const q = useQuery(forecastQuery(point));
  const now = useLiveNow();
  const [tab, setTab] = useState<"nowcast" | "today" | "params">("nowcast");

  // Blitz-Live im 250 km Radius um den aktiven Punkt
  const bbox = useMemo<[number, number, number, number]>(() => {
    const d = 2.5;
    return [point.lon - d, point.lat - d, point.lon + d, point.lat + d];
  }, [point.lat, point.lon]);
  const lightning = useLightningStream({ enabled: true, bbox });

  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  if (!q.data) return null;

  const bundle = q.data;
  const hourlyLive = liveHourly(bundle.hourly, now);

  // Live-Beobachtungsalter und Modell-Konsistenz
  const liveObsAgeMinutes = bundle.current
    ? Math.max(0, (now.getTime() - new Date(bundle.current.observedAt).getTime()) / 60_000)
    : null;
  const modelObsConsistent: boolean | null = (() => {
    if (!bundle.current || hourlyLive.length === 0) return null;
    const dT = Math.abs(bundle.current.temperatureC - hourlyLive[0].temperatureC);
    return dT <= 3;
  })();

  // Blitze in 5 min insgesamt + pro 10-min Step
  const fiveMinAgo = Date.now() - 5 * 60_000;
  const lightning5min = lightning.strikes.filter((s) => s.time >= fiveMinAgo).length;
  const lightningPerStep = Array.from({ length: 12 }, (_, i) => {
    const start = now.getTime() + i * 10 * 60_000 - 10 * 60_000;
    const end = start + 10 * 60_000;
    return lightning.strikes.filter((s) => s.time >= start && s.time < end).length;
  });

  const nowcast = buildNowcast({
    hourly: bundle.hourly,
    minutely: bundle.minutely,
    now,
    lightning5min,
    lightningPerStep,
    liveObsAgeMinutes,
    lightningConnected: lightning.status === "open",
    modelObsConsistent,
  });

  const today = buildToday({
    hourly: hourlyLive,
    liveObsAgeMinutes,
    lightningConnected: lightning.status === "open",
    modelObsConsistent,
  });

  const dataStatus: DataStatus[] = [
    { label: "Forecast", source: "Open-Meteo", ageMinutes: 0, ok: true },
    { label: "Beobachtung", source: bundle.current ? "Open-Meteo Current" : "—", ageMinutes: liveObsAgeMinutes, ok: liveObsAgeMinutes != null && liveObsAgeMinutes <= 120 },
    { label: "DWD-Radar", source: "RY", ok: false, note: "kein Frische-Signal" },
    { label: "Blitz", source: "Blitzortung.org", ok: lightning.status === "open", note: lightning.status === "open" ? `${lightning.strikes.length} im Puffer` : lightning.status },
  ];

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Analyse</h1>
          <p className="text-xs text-muted-foreground">Nowcast 0–2 h · Heute 0–24 h · Parameter — jeder Score ist nachvollziehbar.</p>
        </div>
      </div>

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
            footer="0–2 h: Niederschlag, Wind, Blitz und Live-Signale haben das höchste Gewicht."
          />
          <DataCard title="Teilrisiken" subtitle="Vier Bewertungsachsen, je 0–100, mit den stärksten Beiträgen.">
            <SubscoreBars subs={nowcast.subs} />
          </DataCard>
          <DataCard title="Zeitachse 0–2 h" subtitle="10-Minuten-Schritte mit Blitz, Regen, Wind, Score und Confidence.">
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
            peakLabel={today.peakWindow ? formatWindow(today.peakWindow.startAt, today.peakWindow.endAt) : undefined}
            confidence={today.confidence}
            dataConfidence={today.data.value}
            footer="0–24 h: CAPE, LI, Gewitterwahrscheinlichkeit, Niederschlag und Böen haben das höchste Gewicht."
          />
          <DataCard title="Teilrisiken (Tagesmaximum)" subtitle="Stärkste Stundenbewertung pro Achse.">
            <SubscoreBars subs={today.subs} />
          </DataCard>
          <SevereTimeline hourly={hourlyLive} />
          <ScoreExplainPanel subs={today.subs} data={today.data} reasons={today.reasons} />
          <DataCard title="Datenstatus" subtitle="Sichtbare Quellen, Frische und Verbindung.">
            <DataStatusStrip items={dataStatus} />
          </DataCard>
        </div>
      )}

      {tab === "params" && (
        <ParamGrid />
      )}
    </div>
  );

  function ParamGrid() {
    const nowPoint = hourlyLive[0];
    if (!nowPoint) return null;
    const d = deriveAll(nowPoint);
    const tp = thunderProbability(nowPoint);
    const spreadStr = d.dewPointSpreadK != null ? `${d.dewPointSpreadK.toFixed(1)} K` : "—";
    const k = d.kIndex;
    const tt = d.totalTotals;
    const cape = nowPoint.cape;
    const li = nowPoint.liftedIndex;
    const cin = nowPoint.convectiveInhibition;
    const gustKmh = nowPoint.windGustMs != null ? nowPoint.windGustMs * 3.6 : null;
    const windKmh = nowPoint.windSpeedMs != null ? nowPoint.windSpeedMs * 3.6 : null;

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <ParamCardPro
          title="Temperatur / Taupunkt"
          info={{ title: "Taupunkt", text: "Spread T–Td klein → feuchte Luft. Td ≥ 16 °C schwül, ≥ 20 °C drückend." }}
          value={`${nowPoint.temperatureC.toFixed(1)} °C`}
          unit={`Td ${nowPoint.dewPointC != null ? nowPoint.dewPointC.toFixed(1) + " °C" : "—"}`}
          derived={{ label: "Spread", value: spreadStr }}
          interpretation={`Schwüle: ${d.sultriness}`}
        />
        <ParamCardPro
          title="Wind & Böen"
          info={{ title: "Böen-Schwellen", text: "≥ 50 km/h markant, ≥ 65 Sturmböen, ≥ 90 schwerer Sturm, ≥ 118 Orkan." }}
          value={windKmh != null ? windKmh.toFixed(0) : "—"}
          unit="km/h Mittel"
          derived={{ label: "Spitze", value: gustKmh != null ? `${gustKmh.toFixed(0)} km/h` : "—" }}
          interpretation={d.lowLevelShearMs != null ? `Low-Level-Shear ${d.lowLevelShearMs.toFixed(1)} m/s` : undefined}
        />
        <ParamCardPro
          title="Niederschlag"
          info={{ title: "Starkregen", text: "DWD: ≥ 15 mm/h markant, ≥ 25 heftig, ≥ 40 extrem." }}
          value={nowPoint.precipitationMm != null ? nowPoint.precipitationMm.toFixed(1) : "—"}
          unit="mm/h jetzt"
          derived={{ label: "Wahrscheinlichkeit", value: nowPoint.precipitationProbability != null ? `${nowPoint.precipitationProbability.toFixed(0)} %` : "—" }}
        />
        <ParamCardPro
          title="Druck"
          info={{ title: "Luftdruck", text: "Schnelle Druckänderung deutet auf Wetterumschwung." }}
          value={nowPoint.pressureHpa != null ? nowPoint.pressureHpa.toFixed(0) : "—"}
          unit="hPa MSL"
        />
        <ParamCardPro
          title="CAPE / LI / CIN"
          info={{ title: "Konvektive Energie", text: "CAPE > 0 = instabil. LI < -2 = Gewitter wahrscheinlich. CIN bremst Auslöse." }}
          value={cape != null ? cape.toFixed(0) : "—"}
          unit="J/kg CAPE"
          derived={{ label: "LI / CIN", value: `${li != null ? li.toFixed(1) : "—"} / ${cin != null ? cin.toFixed(0) : "—"}` }}
          band={cape != null ? bandFromScore(Math.min(100, cape / 25)) : undefined}
        />
        <ParamCardPro
          title="K-Index"
          info={{ title: "K-Index", text: "K = (T850-T500) + Td850 - (T700-Td700). ≥20 möglich, ≥30 wahrscheinlich, ≥40 sehr wahrscheinlich." }}
          value={k != null ? k.toFixed(1) : "—"}
          unit="°C"
          interpretation={
            k == null ? "Höhendaten fehlen" :
            k >= 40 ? "Gewitter sehr wahrscheinlich" :
            k >= 30 ? "Gewitter wahrscheinlich" :
            k >= 20 ? "Gewitter möglich" : "kaum Signal"
          }
          band={k == null ? undefined : k >= 40 ? "kritisch" : k >= 30 ? "markant" : k >= 20 ? "aufmerksam" : "ruhig"}
        />
        <ParamCardPro
          title="Total Totals"
          info={{ title: "Total Totals", text: "TT = T850 + Td850 - 2·T500. ≥44 möglich, ≥50 wahrscheinlich, ≥55 schwere Gewitter." }}
          value={tt != null ? tt.toFixed(1) : "—"}
          unit="°C"
          interpretation={
            tt == null ? "Höhendaten fehlen" :
            tt >= 55 ? "schwere Gewitter möglich" :
            tt >= 50 ? "Gewitter wahrscheinlich" :
            tt >= 44 ? "Gewitter möglich" : "kaum Signal"
          }
          band={tt == null ? undefined : tt >= 55 ? "kritisch" : tt >= 50 ? "markant" : tt >= 44 ? "aufmerksam" : "ruhig"}
        />
        <ParamCardPro
          title="Gewitterwahrscheinlichkeit"
          info={{ title: "Heuristisch", text: "Aus CAPE, LI, K, TT und Modellcode. Nicht Modell-Probability." }}
          value={`${Math.round(tp * 100)} %`}
          unit="heuristisch"
        />
        <ParamCardPro
          title="Wolken / Sicht / UV"
          info={{ title: "Atmosphäre", text: "Bedeckung, Sichtweite, UV-Index." }}
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
    case "hochkritisch": return "Hochkritische Wetterlage";
    case "kritisch": return "Kritische Entwicklung";
    case "markant": return "Markante Signale";
    case "aufmerksam": return reasons[0] === "keine Signale über Schwelle" ? "Beobachtungslage" : "Aufmerksam beobachten";
    default: return "Ruhige Lage";
  }
}

function formatWindow(a: string, b: string): string {
  const f = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${f(a)}–${f(b)}`;
}
