import { bandColorClass, bandLabel } from "@/lib/weather/scoring/labels";
import type { Subscore } from "@/lib/weather/scoring/subscores";
import { cn } from "@/lib/utils";

/**
 * Vier horizontale Balken für die Teilrisiken Regen, Wind, Gewitter, Konvektion.
 */
export function SubscoreBars({
  subs,
}: {
  subs: { rain: Subscore; wind: Subscore; thunder: Subscore; convection: Subscore };
}) {
  const rows: Array<{ label: string; sub: Subscore }> = [
    { label: "Regen", sub: subs.rain },
    { label: "Wind", sub: subs.wind },
    { label: "Gewitter", sub: subs.thunder },
    { label: "Konvektion", sub: subs.convection },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => <Row key={r.label} label={r.label} sub={r.sub} />)}
    </div>
  );
}

function Row({ label, sub }: { label: string; sub: Subscore }) {
  const c = bandColorClass(sub.band);
  const top = sub.contributors.slice(0, 3);
  return (
    <div className="rounded-lg border border-border bg-background/60 p-2.5">
      <div className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("absolute inset-y-0 left-0 rounded-full", c.bg)} style={{ width: `${Math.max(2, sub.value)}%` }} />
        </div>
        <div className="font-mono text-sm font-semibold tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{sub.value}</div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-muted-foreground">
        <span className={cn("rounded px-1.5 py-0.5 font-semibold uppercase", c.soft)}>
          {bandLabel(sub.band)}
        </span>
        {top.length === 0 ? (
          <span>keine Beiträge</span>
        ) : top.map((t) => (
          <span key={t.label} className="font-mono" style={{ fontFamily: "var(--font-mono)" }}>
            {t.label} {t.raw} <span className="text-foreground/70">+{t.points.toFixed(0)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}