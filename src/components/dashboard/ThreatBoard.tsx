import { useState } from "react";
import { Card } from "@/components/ui/card";
import { SegmentedTabs } from "@/components/common/SegmentedTabs";
import { DataMeta } from "@/components/common/DataMeta";
import { WarnBadge } from "@/components/common/WarnBadge";
import { MeteoconIcon } from "@/components/weather/MeteoconIcon";
import { useLiveNow } from "@/hooks/use-live-now";
import { liveHourly } from "@/lib/weather/live";
import { buildNowcast2h, type NowcastStep } from "@/lib/weather/analysis/nowcast";
import { buildHazards, formatHazardWindow, type Hazard, type HazardKind } from "@/lib/weather/analysis/hazards";
import { severeScore, severeTimeline, summarizeModelSevere } from "@/lib/weather/analysis/convection";
import type { AlertSeverity, ForecastBundle, WeatherAlert } from "@/lib/weather/types";
import { cn } from "@/lib/utils";
import { Activity, AlertOctagon, Zap } from "lucide-react";

type TabId = "now" | "nowcast" | "today";

/**
 * ThreatBoard – die zentrale, intelligente Gewitter-/Unwetterkarte des Dashboards.
 * Ersetzt die früheren drei separaten Severe-Panels und bietet drei Sub-Tabs:
 *   - Jetzt: aktuelle Lage + aktive Warnungen + Top-Gefahren
 *   - Nowcast 0–2 h: 10-Minuten-Auflösung
 *   - Heute 0–24 h: Peak-Fenster mit Klartext
 */
export function ThreatBoard({ bundle, alerts }: { bundle: ForecastBundle; alerts: WeatherAlert[] }) {
  const now = useLiveNow();
  const [tab, setTab] = useState<TabId>("now");
  const hourly = liveHourly(bundle.hourly, now);
  const sum24 = summarizeModelSevere(hourly, 24);
  const hazardSet = buildHazards({ ...bundle, hourly });
  const nc = buildNowcast2h(bundle.hourly, bundle.minutely, now);

  return (
    <Card
      className="relative flex flex-col gap-4 overflow-hidden p-4 md:p-5"
      style={{ boxShadow: "var(--shadow-elegant)" }}
    >
      <Header
        worstSevere={hazardSet.worstSevere}
        score24={sum24.worstScore}
        scoreNowcast={nc.peakScore}
        nowcastLevel={nc.peakLevel}
        hazardCount={hazardSet.hazards.length}
      />

      <SegmentedTabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "now", label: "Jetzt", icon: <Activity className="h-3.5 w-3.5" /> },
          { id: "nowcast", label: "Nowcast 2 h", icon: <Zap className="h-3.5 w-3.5" /> },
          { id: "today", label: "Heute 24 h", icon: <AlertOctagon className="h-3.5 w-3.5" /> },
        ]}
      />

      <div className="min-h-[260px]">
        {tab === "now" && <NowTab hazardSet={hazardSet} alerts={alerts} bundle={bundle} />}
        {tab === "nowcast" && <NowcastTab steps={nc.steps} headline={nc.headline} confidence={nc.confidence} thunderProbMax={nc.thunderProbMax} precipMax={nc.precipMaxMmPerH} precipSum={nc.precipSumMm} hailMax={nc.hailMax} />}
        {tab === "today" && <TodayTab bundle={bundle} hazardSet={hazardSet} />}
      </div>

      <DataMeta meta={bundle.meta} />
    </Card>
  );
}

/* ---------- Header ---------- */

function Header({
  worstSevere, score24, scoreNowcast, nowcastLevel, hazardCount,
}: {
  worstSevere: AlertSeverity | "none";
  score24: number;
  scoreNowcast: number;
  nowcastLevel: AlertSeverity | "none";
  hazardCount: number;
}) {
  const headline = worstSevere === "extreme" ? "Extremes Unwetter im Fokus"
    : worstSevere === "severe" ? "Schweres Unwettersignal heute"
    : worstSevere === "moderate" ? "Unwetterpotenzial heute"
    : worstSevere === "minor" ? "Markante Wetterlage"
    : "Ruhige Wetterlage";
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      <div className={cn(
        "grid h-14 w-14 shrink-0 place-items-center rounded-2xl",
        worstSevere === "extreme" ? "bg-warn-extreme/15 ring-1 ring-warn-extreme/40"
        : worstSevere === "severe" ? "bg-warn-severe/15 ring-1 ring-warn-severe/40"
        : worstSevere === "moderate" ? "bg-warn-moderate/15 ring-1 ring-warn-moderate/40"
        : worstSevere === "minor" ? "bg-warn-minor/15 ring-1 ring-warn-minor/40"
        : "bg-muted ring-1 ring-border",
      )}>
        <MeteoconIcon name="thunderstorms-day-rain" label="Gewitter" className="h-10 w-10" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gewitter & Unwetter</div>
        <div className="truncate text-base font-semibold text-foreground md:text-lg">{headline}</div>
        <div className="text-xs text-muted-foreground">
          {hazardCount} {hazardCount === 1 ? "Gefahr" : "Gefahren"} erkannt
          {" · "}Nowcast {scoreNowcast}/100 · Heute {score24}/100
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {worstSevere !== "none" && <WarnBadge severity={worstSevere} />}
        {nowcastLevel !== "none" && nowcastLevel !== worstSevere && (
          <WarnBadge severity={nowcastLevel} label={`2h ${labelSev(nowcastLevel)}`} className="text-[10px]" />
        )}
      </div>
    </div>
  );
}

/* ---------- Tab: Jetzt ---------- */

function NowTab({ hazardSet, alerts, bundle }: { hazardSet: ReturnType<typeof buildHazards>; alerts: WeatherAlert[]; bundle: ForecastBundle }) {
  const top = hazardSet.hazards.slice(0, 6);
  const officialActive = alerts.filter((a) => a.source !== "dwd" || a.id.startsWith("derived-") === false);
  const firstPoint = bundle.hourly[0];
  const liveScore = firstPoint ? severeScore(firstPoint) : { value: 0, level: "none" as const, reasons: [] };
  return (
    <div className="flex flex-col gap-3">
      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Live-Score" value={`${liveScore.value}`} unit="/100" tone={liveScore.level} />
        <Stat label="Aktive Warnungen" value={`${officialActive.length}`} unit="amtlich" tone={officialActive.length ? "moderate" : "none"} />
        <Stat label="Erkannte Gefahren" value={`${hazardSet.hazards.length}`} unit="Typen" tone={hazardSet.worstSevere !== "none" ? "minor" : "none"} />
        <Stat label="Peak-Fenster" value={hazardSet.peakWindow ? fmtRange(hazardSet.peakWindow.start, hazardSet.peakWindow.end) : "—"} unit="heute" tone={hazardSet.peakWindow ? "minor" : "none"} />
      </div>

      {/* Hazards */}
      {top.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {top.map((h) => <HazardRow key={h.id} h={h} />)}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
          Keine markanten Gefahren in den nächsten 24 Stunden.
        </div>
      )}
    </div>
  );
}

function HazardRow({ h }: { h: Hazard }) {
  return (
    <div className={cn(
      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2.5",
      KIND_BORDER[h.kind],
    )}>
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md text-base", KIND_DOT[h.kind])}>
        {ICON_BY_CAT[h.category]}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{h.title}</span>
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {h.description} · {formatHazardWindow(h)}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {h.peakValue && <span className="font-mono text-xs font-semibold text-foreground">{h.peakValue}</span>}
        <span className="text-[10px] text-muted-foreground">Konfidenz {h.confidence}/5</span>
      </div>
    </div>
  );
}

const KIND_BORDER: Record<HazardKind, string> = {
  minor: "border-warn-minor/40 bg-warn-minor/5",
  moderate: "border-warn-moderate/50 bg-warn-moderate/10",
  severe: "border-warn-severe/60 bg-warn-severe/10",
  extreme: "border-warn-extreme/60 bg-warn-extreme/10",
  heat: "border-heat/50 bg-heat/10",
  cold: "border-cold/50 bg-cold/10",
  info: "border-border bg-background/60",
};
const KIND_DOT: Record<HazardKind, string> = {
  minor: "bg-warn-minor/20 text-warn-minor-fg",
  moderate: "bg-warn-moderate/25 text-warn-moderate-fg",
  severe: "bg-warn-severe/25 text-warn-severe-fg",
  extreme: "bg-warn-extreme/25 text-warn-extreme-fg",
  heat: "bg-heat/25 text-heat-fg",
  cold: "bg-cold/25 text-cold-fg",
  info: "bg-muted text-foreground",
};
const ICON_BY_CAT: Record<Hazard["category"], string> = {
  thunderstorm: "⛈",
  hail: "🧊",
  wind: "💨",
  rain: "🌧",
  snow: "❄",
  ice: "🧊",
  fog: "🌫",
  heat: "🌡",
  cold: "🥶",
  uv: "☀",
  tornado: "🌪",
};

/* ---------- Tab: Nowcast 2h ---------- */

function NowcastTab({
  steps, headline, confidence, thunderProbMax, precipMax, precipSum, hailMax,
}: {
  steps: NowcastStep[];
  headline: string;
  confidence: "niedrig" | "mittel" | "hoch";
  thunderProbMax: number;
  precipMax: number;
  precipSum: number;
  hailMax: AlertSeverity | "none";
}) {
  const maxBar = Math.max(10, ...steps.map((s) => Math.max(s.severeScore, s.precipMmPerH * 4)));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-foreground">{headline}</div>
        <div className="text-[11px] text-muted-foreground">Vertrauen {confidence}</div>
      </div>
      <div className="grid grid-cols-12 gap-1.5">
        {steps.map((s) => (
          <NowcastBar key={s.time} step={s} max={maxBar} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Gewitter Peak" value={`${Math.round(thunderProbMax * 100)}`} unit="%" tone={thunderProbMax >= 0.5 ? "moderate" : thunderProbMax >= 0.3 ? "minor" : "none"} />
        <Stat label="Regen Spitze" value={precipMax.toFixed(1)} unit="mm/h" tone={precipMax >= 15 ? "moderate" : precipMax >= 5 ? "minor" : "none"} />
        <Stat label="Regen Σ 2h" value={precipSum.toFixed(1)} unit="mm" tone={precipSum >= 10 ? "moderate" : precipSum >= 3 ? "minor" : "none"} />
        <Stat label="Hagel" value={hailMax === "none" ? "—" : labelSev(hailMax)} unit="" tone={hailMax === "none" ? "none" : hailMax} />
      </div>
    </div>
  );
}

function NowcastBar({ step, max }: { step: NowcastStep; max: number }) {
  const h = Math.max(6, Math.round((step.severeScore / max) * 100));
  const bg = step.level === "extreme" ? "bg-warn-extreme"
    : step.level === "severe" ? "bg-warn-severe"
    : step.level === "moderate" ? "bg-warn-moderate"
    : step.level === "minor" ? "bg-warn-minor"
    : step.precipMmPerH >= 0.5 ? "bg-primary/60" : "bg-muted";
  return (
    <div
      className="flex min-w-0 flex-col items-center gap-1"
      title={`+${step.minutesFromNow} min · Score ${step.severeScore} · Regen ${step.precipMmPerH.toFixed(1)} mm/h · Gewitter ${Math.round(step.thunderProb * 100)} %`}
    >
      <div className="font-mono text-[9px] leading-none text-muted-foreground">
        {step.minutesFromNow === 0 ? "jetzt" : `+${step.minutesFromNow}`}
      </div>
      <div className="relative flex h-24 w-full items-end overflow-hidden rounded-md bg-muted/40">
        <div className={cn("w-full transition-all", bg)} style={{ height: `${h}%` }} />
        {step.hail !== "none" && (
          <div className="absolute left-0 right-0 top-0 h-1 bg-warn-extreme" title="Hagelrisiko" />
        )}
        {step.thunderProb >= 0.3 && step.hail === "none" && (
          <div className="absolute left-0 right-0 top-0 h-1 bg-warn-moderate/80" title="Gewitter" />
        )}
      </div>
      <div className="font-mono text-[10px] font-semibold leading-none">{step.severeScore}</div>
    </div>
  );
}

/* ---------- Tab: Heute 24h ---------- */

function TodayTab({ bundle, hazardSet }: { bundle: ForecastBundle; hazardSet: ReturnType<typeof buildHazards> }) {
  const sum24 = summarizeModelSevere(bundle.hourly, 24);
  const tl = severeTimeline(bundle.hourly, 24);
  const peakWin = hazardSet.peakWindow;

  // Spitzenwerte im Peak-Fenster
  const peakHours = peakWin
    ? bundle.hourly.filter((p) => p.time >= peakWin.start && p.time <= peakWin.end)
    : [];
  const peakStats = {
    cape: Math.max(0, ...peakHours.map((p) => p.cape ?? 0)),
    li: Math.min(0, ...peakHours.map((p) => p.liftedIndex ?? 0)),
    gust: Math.max(0, ...peakHours.map((p) => p.windGustMs ?? 0)),
    rain: Math.max(0, ...peakHours.map((p) => p.precipitationMm ?? 0)),
    tp: Math.max(0, ...peakHours.map((p) => (p.weatherCode != null && p.weatherCode >= 95 ? 1 : 0))),
  };

  const peakText = peakWin
    ? `Hauptrisiko im Fenster ${fmtRange(peakWin.start, peakWin.end)}: CAPE bis ${peakStats.cape.toFixed(0)} J/kg, LI ${peakStats.li.toFixed(1)}, Böen bis ${(peakStats.gust * 3.6).toFixed(0)} km/h.`
    : "Kein zusammenhängendes Unwetterfenster in den nächsten 24 Stunden.";

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-gradient-to-br from-card to-muted/30 p-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gewitter-Peak heute</span>
          {peakWin && <span className="font-mono text-sm font-semibold text-foreground">{fmtRange(peakWin.start, peakWin.end)}</span>}
        </div>
        <p className="mt-1.5 text-sm text-foreground">{peakText}</p>
        {peakWin && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Mini label="CAPE" value={`${peakStats.cape.toFixed(0)}`} unit="J/kg" />
            <Mini label="LI" value={`${peakStats.li.toFixed(1)}`} unit="" />
            <Mini label="Böen" value={`${(peakStats.gust * 3.6).toFixed(0)}`} unit="km/h" />
            <Mini label="Regen" value={`${peakStats.rain.toFixed(1)}`} unit="mm/h" />
            <Mini label="Gewitter" value={peakStats.tp > 0 ? "ja" : "ind."} unit="" />
          </div>
        )}
      </div>

      {/* Mini-Heatmap 24 h */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Severity 24 h</span>
          <span>Score {sum24.worstScore}/100</span>
        </div>
        <div className="grid grid-cols-24 gap-[2px]">
          {tl.map((h, i) => (
            <div
              key={h.time}
              className={cn(
                "h-8 rounded-[3px] transition-colors",
                h.score.level === "extreme" ? "bg-warn-extreme"
                : h.score.level === "severe" ? "bg-warn-severe"
                : h.score.level === "moderate" ? "bg-warn-moderate"
                : h.score.level === "minor" ? "bg-warn-minor"
                : "bg-muted",
              )}
              title={`${new Date(h.time).toLocaleTimeString("de-DE", { hour: "2-digit" })} Uhr · Score ${h.score.value}`}
              style={{ opacity: 0.35 + Math.min(0.65, h.score.value / 100) }}
            >
              {(i % 6 === 0) && (
                <div className="pt-[34px] text-center font-mono text-[8px] text-muted-foreground">
                  {new Date(h.time).getHours()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Bausteine ---------- */

function Stat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: AlertSeverity | "none" }) {
  return (
    <div className={cn(
      "min-w-0 rounded-lg border px-2.5 py-2",
      tone === "extreme" ? "border-warn-extreme/50 bg-warn-extreme/10"
      : tone === "severe" ? "border-warn-severe/50 bg-warn-severe/10"
      : tone === "moderate" ? "border-warn-moderate/50 bg-warn-moderate/10"
      : tone === "minor" ? "border-warn-minor/50 bg-warn-minor/10"
      : "border-border bg-background/60",
    )}>
      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="truncate font-mono text-lg font-semibold leading-tight text-foreground">{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function Mini({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md border border-border bg-card/50 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-sm font-semibold">{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function fmtRange(a: string, b: string) {
  const f = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${f(a)}–${f(b)}`;
}

function labelSev(s: AlertSeverity | "none"): string {
  return s === "extreme" ? "extrem" : s === "severe" ? "schwer" : s === "moderate" ? "mäßig" : s === "minor" ? "gering" : "—";
}