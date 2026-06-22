import { AlertTriangle, CheckCircle2, CircleHelp, Droplets, Flame, MoveUpRight, Radio, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TriggerLight, RadarLightningCheck, ModelObsCheck, CellTrack, Verdict } from "@/lib/weather/analysis/cockpit-diagnostics";

/* -------------------- Trigger-Ampel -------------------- */

export function TriggerLightCard({ t }: { t: TriggerLight }) {
  const rows: { key: keyof TriggerLight; label: string; icon: typeof Droplets }[] = [
    { key: "moisture",     label: "Feuchte",         icon: Droplets },
    { key: "instability",  label: "Instabilität",    icon: Flame },
    { key: "lift",         label: "Hebung / Trigger", icon: MoveUpRight },
    { key: "precipSignal", label: "Niederschlag",    icon: Radio },
    { key: "liveConfirm",  label: "Live-Signal",     icon: Zap },
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <Header title="Auslöser-Ampel" subtitle={t.summary} />
      <ul className="mt-2 grid gap-1.5">
        {rows.map((r) => {
          const v = t[r.key] as Verdict;
          const Icon = r.icon;
          return (
            <li key={r.key} className="grid grid-cols-[16px_1fr_auto] items-center gap-2 text-[12px]">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">{r.label}</span>
              <VerdictPill v={v} />
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Schwellen: CAPE ≥ 500/1500, LI ≤ −2/−4, Spread T–Td ≤ 6/3 K, Böen ≥ 12/18 m/s, Blitze ≥ 1/5 in 5 min.
      </p>
    </section>
  );
}

function VerdictPill({ v }: { v: Verdict }) {
  const map: Record<Verdict, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
    ok:      { label: "ok",      tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", Icon: CheckCircle2 },
    watch:   { label: "watch",   tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",       Icon: AlertTriangle },
    alert:   { label: "alert",   tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300",          Icon: AlertTriangle },
    unknown: { label: "unbekannt", tone: "bg-muted text-muted-foreground",                          Icon: CircleHelp },
  };
  const { label, tone, Icon } = map[v];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px]", tone)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

/* -------------------- Blitz vs Radar -------------------- */

export function BlitzRadarCard({ c }: { c: RadarLightningCheck }) {
  const tone =
    c.state === "consistent" ? "border-rose-500/40 bg-rose-500/5" :
    c.state === "lightning_no_echo" ? "border-amber-500/40 bg-amber-500/5" :
    c.state === "echo_no_lightning" ? "border-sky-500/40 bg-sky-500/5" :
    c.state === "quiet" ? "border-emerald-500/30 bg-emerald-500/5" :
    "border-border bg-card";
  const stateLabel: Record<RadarLightningCheck["state"], string> = {
    consistent: "Konsistent",
    echo_no_lightning: "Echo ohne Blitz",
    lightning_no_echo: "Blitz ohne Echo",
    quiet: "Ruhig",
    unknown: "Unklar",
  };
  return (
    <section className={cn("rounded-xl border p-3", tone)}>
      <Header title="Blitz ↔ Radar" subtitle={stateLabel[c.state]} />
      <p className="mt-1 text-[12px] text-foreground">{c.detail}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground">
        <Line label="Blitze 15 min" value={`${c.lightning15min}`} />
        <Line label="RY-Alter" value={c.ryLagMin != null ? `${c.ryLagMin} min` : "—"} />
      </div>
    </section>
  );
}

/* -------------------- Modell vs Beobachtung -------------------- */

export function ModelObsCard({ c }: { c: ModelObsCheck }) {
  const tone =
    c.state === "match" ? "border-emerald-500/30 bg-emerald-500/5" :
    c.state === "model_overcalls" ? "border-amber-500/40 bg-amber-500/5" :
    c.state === "model_underestimates" ? "border-rose-500/40 bg-rose-500/5" :
    "border-border bg-card";
  const label: Record<ModelObsCheck["state"], string> = {
    match: "Modell und Beobachtung passen",
    model_overcalls: "Modell überschätzt",
    model_underestimates: "Modell unterschätzt",
    unknown: "Keine Aussage möglich",
  };
  return (
    <section className={cn("rounded-xl border p-3", tone)}>
      <Header title="Modell ↔ Beobachtung" subtitle={label[c.state]} />
      <p className="mt-1 text-[12px] text-foreground">{c.detail}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground">
        <Line label="Modell erwartet" value={c.modelExpectsConvection ? "Konvektion" : "—"} />
        <Line label="Beobachtet" value={c.observedConvection ? "Aktivität" : "—"} />
      </div>
    </section>
  );
}

/* -------------------- Cell-Tracking Light -------------------- */

export function CellTrackCard({ t }: { t: CellTrack }) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <Header title="Zell-Tracking" subtitle={t.hasTrack ? "Bewegungsschätzung aus Blitzschwerpunkten" : "Wartet auf genügend Blitze"} />
      {t.hasTrack ? (
        <div className="mt-1 grid gap-1 font-mono text-[12px]">
          <Line label="Richtung" value={`${t.bearingCompass} (${Math.round(t.bearingDeg ?? 0)}°)`} />
          <Line label="Geschwindigkeit" value={t.speedKmh != null ? `${t.speedKmh.toFixed(0)} km/h` : "—"} />
          <Line label="Abstand Fokus" value={t.distanceKm != null ? `${t.distanceKm.toFixed(0)} km` : "—"} />
          <Line label="Annäherung" value={t.approachingFocus ? `ja · ETA ${t.etaMinutes ?? "—"} min` : "nein"} />
        </div>
      ) : (
        <p className="mt-1 text-[12px] text-muted-foreground">{t.detail}</p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">Vereinfachte Heuristik aus Blitzortung. Kein vollwertiges Nowcasting.</p>
    </section>
  );
}

/* -------------------- Confidence by Source -------------------- */

export interface SourceConfidence {
  key: string;
  label: string;
  state: "good" | "limited" | "missing";
  detail: string;
}

export function SourceConfidenceGrid({ items }: { items: SourceConfidence[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <Header title="Vertrauen je Quelle" subtitle="Pro Datenstrom separat bewertet." />
      <ul className="mt-2 grid gap-1">
        {items.map((it) => {
          const tone =
            it.state === "good" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
            it.state === "limited" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
            "bg-rose-500/15 text-rose-700 dark:text-rose-300";
          const stateLabel = it.state === "good" ? "ok" : it.state === "limited" ? "eingeschränkt" : "fehlt";
          return (
            <li key={it.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[12px]">
              <span className="font-semibold text-foreground">{it.label}</span>
              <span className="truncate text-muted-foreground">{it.detail}</span>
              <span className={cn("rounded-md px-2 py-0.5 font-mono text-[10px]", tone)}>{stateLabel}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------- shared -------------------- */

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-foreground">{title}</h3>
      <span className="truncate text-[11px] text-muted-foreground">{subtitle}</span>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right text-foreground">{value}</span>
    </div>
  );
}