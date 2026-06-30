import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Droplets,
  Flame,
  MoveUpRight,
  Radio,
  Zap,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import type {
  TriggerLight,
  ModelObsCheck,
  Verdict,
} from "@/lib/weather/analysis/cockpit-diagnostics";

export function TriggerLightCard({ t }: { t: TriggerLight }) {
  const rows: { key: keyof TriggerLight; label: string; icon: typeof Droplets }[] = [
    { key: "moisture", label: "Feuchte", icon: Droplets },
    { key: "instability", label: "Instabilität", icon: Flame },
    { key: "lift", label: "Hebung / Trigger", icon: MoveUpRight },
    { key: "precipSignal", label: "Niederschlag", icon: Radio },
    { key: "liveConfirm", label: "Radar-Echo", icon: Zap },
  ];
  return (
    <section className="rounded-xl border border-border/60 bg-card/75 p-3 shadow-elegant backdrop-blur-xl">
      <Header title="Auslöser-Ampel" subtitle={t.summary} />
      <ul className="mt-2 grid gap-1.5">
        {rows.map((r) => {
          const v = t[r.key] as Verdict;
          const Icon = r.icon;
          return (
            <li
              key={String(r.key)}
              className="grid grid-cols-[16px_1fr_auto] items-center gap-2 text-[12px]"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">{r.label}</span>
              <VerdictPill v={v} />
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Schwellen: CAPE ≥ 500/1500, LI ≤ −2/−4, Spread T–Td ≤ 6/3 K, Böen ≥ 12/18 m/s, Radar ≥
        40/50 dBZ.
      </p>
    </section>
  );
}

function VerdictPill({ v }: { v: Verdict }) {
  const map: Record<Verdict, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
    ok: {
      label: "ok",
      tone: "bg-primary/15 text-primary",
      Icon: CheckCircle2,
    },
    watch: {
      label: "watch",
      tone: "bg-muted text-foreground/80",
      Icon: AlertTriangle,
    },
    alert: {
      label: "alert",
      tone: "bg-destructive/15 text-destructive",
      Icon: AlertTriangle,
    },
    unknown: { label: "unbekannt", tone: "bg-muted text-muted-foreground", Icon: CircleHelp },
  };
  const { label, tone, Icon } = map[v];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px]",
        tone,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function ModelObsCard({ c }: { c: ModelObsCheck }) {
  const tone =
    c.state === "match"
      ? "border-primary/30 bg-primary/10"
      : c.state === "model_overcalls"
        ? "border-border bg-muted/40"
        : c.state === "model_underestimates"
          ? "border-destructive/40 bg-destructive/10"
          : "border-border/60 bg-card/75";
  const label: Record<ModelObsCheck["state"], string> = {
    match: "Modell und Radar passen",
    model_overcalls: "Modell überschätzt",
    model_underestimates: "Modell unterschätzt",
    unknown: "Keine Aussage möglich",
  };
  return (
    <section className={cn("rounded-xl border p-3 shadow-elegant backdrop-blur-xl", tone)}>
      <Header title="Modell ↔ Radar" subtitle={label[c.state]} />
      <p className="mt-1 text-[12px] text-foreground">{c.detail}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground">
        <Line label="Modell erwartet" value={c.modelExpectsConvection ? "Konvektion" : "—"} />
        <Line label="Beobachtet" value={c.observedConvection ? "Aktivität" : "—"} />
      </div>
    </section>
  );
}

export interface SourceConfidence {
  key: string;
  label: string;
  state: "good" | "limited" | "missing";
  detail: string;
}

export function SourceConfidenceGrid({ items }: { items: SourceConfidence[] }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/75 p-3 shadow-elegant backdrop-blur-xl">
      <Header title="Vertrauen je Quelle" subtitle="Pro Datenstrom separat bewertet." />
      <ul className="mt-2 grid gap-1">
        {items.map((it) => {
          const tone =
            it.state === "good"
              ? "bg-primary/15 text-primary"
              : it.state === "limited"
                ? "bg-muted text-foreground/80"
                : "bg-destructive/15 text-destructive";
          const stateLabel =
            it.state === "good" ? "ok" : it.state === "limited" ? "eingeschränkt" : "fehlt";
          return (
            <li
              key={it.key}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[12px]"
            >
              <span className="font-semibold text-foreground">{it.label}</span>
              <span className="truncate text-muted-foreground">{it.detail}</span>
              <span className={cn("rounded-md px-2 py-0.5 font-mono text-[10px]", tone)}>
                {stateLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="font-display text-[12px] font-semibold uppercase tracking-wider text-foreground">{title}</h3>
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