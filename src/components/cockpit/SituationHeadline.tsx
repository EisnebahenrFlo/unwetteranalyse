import { Card } from "@/components/ui/card";
import { WarnBadge } from "@/components/common/WarnBadge";
import { SeverityRail, scoreToLevel } from "@/components/common/SeverityRail";
import { TendencyBadge, deriveTendency } from "./TendencyBadge";
import { MeteoconIcon, isNightAt } from "@/components/weather/MeteoconIcon";
import { severeScore, summarizeModelSevere } from "@/lib/weather/analysis/convection";
import { buildHazards, formatHazardWindow } from "@/lib/weather/analysis/hazards";
import { buildNowcast2h } from "@/lib/weather/analysis/nowcast";
import { useLiveNow } from "@/hooks/use-live-now";
import { formatHour } from "@/lib/weather/format";
import type { ForecastBundle, WeatherAlert } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

interface Props {
  bundle: ForecastBundle;
  officialAlerts: WeatherAlert[];
}

/**
 * Primärbereich: liefert in einem Blick die meteorologische Gesamtlage.
 * Beantwortet: Was ist gerade los, wo liegt die Hauptgefahr, wie relevant
 * ist es, wohin entwickelt es sich kurzfristig?
 */
export function SituationHeadline({ bundle, officialAlerts }: Props) {
  const now = useLiveNow();
  const hazardSet = buildHazards(bundle);
  const sum24 = summarizeModelSevere(bundle.hourly, 24);
  const nc = buildNowcast2h(bundle.hourly, bundle.minutely, now);
  const live = bundle.hourly[0]
    ? severeScore(bundle.hourly[0])
    : { value: 0, level: "none" as const, reasons: [] };
  const tendency = deriveTendency(live.value, nc.peakScore);

  const lead = hazardSet.hazards[0] ?? null;
  const worst = hazardSet.worstSevere;
  const score = Math.max(sum24.worstScore, nc.peakScore);
  const label = scoreLabel(score);
  const night = isNightAt(bundle.hourly[0]?.time ?? new Date().toISOString(), bundle.daily);

  const kernSatz = composeStatement({
    worst,
    score,
    lead,
    leadWindow: lead ? formatHazardWindow(lead) : null,
    nowcastHeadline: nc.headline,
    officialCount: officialAlerts.length,
  });
  const stufe = scoreToLevel(score);

  return (
    <Card className="grid grid-cols-1 gap-6 p-5 md:p-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
      {/* Primärblock: lauter Hero */}
      <div className="flex min-w-0 flex-col gap-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
          <div
            className={cn(
              "grid h-16 w-16 shrink-0 place-items-center rounded-2xl ring-1 md:h-20 md:w-20",
              scoreRing(score),
            )}
          >
            <MeteoconIcon
              code={bundle.hourly[0]?.weatherCode}
              isNight={night}
              name={worst === "none" ? undefined : "thunderstorms-day-rain"}
              label="Lage"
              className="h-14 w-14 md:h-16 md:w-16"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Aktuelle Lage · {bundle.point.name}
              {bundle.point.admin ? ` · ${bundle.point.admin}` : ""}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-5xl font-semibold leading-none tabular-nums text-foreground md:text-6xl">
                {score}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                  scorePill(score),
                )}
              >
                {label}
              </span>
            </div>
          </div>
        </div>

        {/* Klartext-Lagesatz, dominant in Display-Font */}
        <p className="font-display text-2xl font-semibold leading-[1.18] tracking-tight text-foreground md:text-[28px] lg:text-[32px]">
          {kernSatz}
        </p>

        {/* Stufenband horizontal, voll prominent */}
        <SeverityRail
          level={stufe}
          orientation="horizontal"
          label={stufe ? `Stufe ${stufe}` : "Stufe 0 · ruhig"}
          className="w-full"
        />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {worst !== "none" && <WarnBadge severity={worst} />}
          <TendencyBadge tendency={tendency} />
          {officialAlerts.length > 0 && (
            <span className="inline-flex items-center rounded-md border border-warn-moderate/40 bg-warn-moderate/10 px-2 py-0.5 text-[11px] font-medium text-warn-moderate">
              {officialAlerts.length} amtl. Warnung{officialAlerts.length === 1 ? "" : "en"}
            </span>
          )}
        </div>
      </div>

      {/* Sekundärblock: Hauptgefahr + Fenster */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-1">
        <Kpi
          label="Hauptgefahr"
          value={lead?.title ?? "Keine"}
          hint={lead ? lead.description : "Keine markante Gefahr in 24 h."}
        />
        <Kpi
          label="Hauptfenster"
          value={
            hazardSet.peakWindow
              ? `${formatHour(hazardSet.peakWindow.start)}–${formatHour(hazardSet.peakWindow.end)}`
              : "—"
          }
          hint={
            nc.peakStep && nc.peakScore > 20
              ? `Peak 2 h: +${nc.peakStep.minutesFromNow} min, Score ${nc.peakScore}`
              : "Kein zusammenhängendes Severe-Fenster."
          }
        />
        <Kpi
          label="Live jetzt"
          value={live.value > 0 ? `${live.value}/100` : "ruhig"}
          hint={
            live.reasons.length
              ? live.reasons.slice(0, 2).join(" · ")
              : "Keine konvektiven Signale."
          }
        />
        <Kpi label="Nowcast 2 h" value={`${nc.peakScore}/100`} hint={nc.headline} />
      </div>
    </Card>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</div>
      {hint && <div className="line-clamp-2 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function scoreLabel(s: number): string {
  if (s >= 70) return "Unwetterartig";
  if (s >= 45) return "Markant";
  if (s >= 20) return "Erhöht";
  return "Ruhig";
}
function scorePill(s: number): string {
  if (s >= 70) return "bg-warn-severe/15 text-warn-severe";
  if (s >= 45) return "bg-warn-moderate/15 text-warn-moderate";
  if (s >= 20) return "bg-warn-minor/15 text-warn-minor";
  return "bg-muted text-muted-foreground";
}
function scoreRing(s: number): string {
  if (s >= 70) return "bg-warn-severe/10 ring-warn-severe/40";
  if (s >= 45) return "bg-warn-moderate/10 ring-warn-moderate/40";
  if (s >= 20) return "bg-warn-minor/10 ring-warn-minor/40";
  return "bg-muted ring-border";
}

function composeStatement({
  worst,
  score,
  lead,
  leadWindow,
  nowcastHeadline,
  officialCount,
}: {
  worst: "minor" | "moderate" | "severe" | "extreme" | "none";
  score: number;
  lead: ReturnType<typeof buildHazards>["hazards"][number] | null;
  leadWindow: string | null;
  nowcastHeadline: string;
  officialCount: number;
}): string {
  if (worst === "none" && score < 20) {
    return `Ruhige Wetterlage ohne markante Signale. ${nowcastHeadline}.`;
  }
  const sevText =
    worst === "extreme"
      ? "Extreme Unwetterlage"
      : worst === "severe"
        ? "Schwere Unwetterlage"
        : worst === "moderate"
          ? "Unwetterpotenzial vorhanden"
          : worst === "minor"
            ? "Markante Wetterlage"
            : "Erhöhte Lage";
  const leadText = lead
    ? `${lead.title.toLowerCase()} führend (${leadWindow ?? "im Tagesverlauf"})`
    : "ohne klare Einzelgefahr";
  const offText =
    officialCount > 0
      ? `, ${officialCount} amtl. Warnung${officialCount === 1 ? "" : "en"} aktiv`
      : "";
  return `${sevText}, ${leadText}${offText}. ${nowcastHeadline}.`;
}
