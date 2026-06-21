import type { Subscore } from "@/lib/weather/scoring/subscores";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ScoreExplainPanel({
  subs, data, reasons,
}: {
  subs: { rain: Subscore; wind: Subscore; thunder: Subscore; convection: Subscore };
  data: Subscore;
  reasons: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-background/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold tracking-wide text-foreground"
      >
        <span>Wie kommt der Score zustande?</span>
        <span className="text-[10px] text-muted-foreground">{open ? "▴ schließen" : "▾ öffnen"}</span>
      </button>
      {!open && reasons.length > 0 && (
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          {reasons.join(" · ")}
        </div>
      )}
      {open && (
        <div className="border-t border-border p-3 text-[11px]">
          <div className="grid gap-3 md:grid-cols-2">
            <Block label="Regen" sub={subs.rain} />
            <Block label="Wind" sub={subs.wind} />
            <Block label="Gewitter" sub={subs.thunder} />
            <Block label="Konvektion" sub={subs.convection} />
          </div>
          <Block label="Datenvertrauen" sub={data} className="mt-3" />
        </div>
      )}
    </div>
  );
}

function Block({ label, sub, className }: { label: string; sub: Subscore; className?: string }) {
  return (
    <div className={cn("rounded-md border border-border/60 bg-background/40 p-2", className)}>
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground">{label}</div>
        <div className="font-mono text-xs font-semibold tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{sub.value}/100</div>
      </div>
      <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
        {sub.contributors.length === 0 && <li>keine Beiträge über Schwelle</li>}
        {sub.contributors.map((c) => (
          <li key={c.label} className="flex justify-between gap-2 font-mono" style={{ fontFamily: "var(--font-mono)" }}>
            <span className="truncate"><span className="text-foreground/80">{c.label}</span> · {c.raw}</span>
            <span className={c.points >= 0 ? "text-foreground/80" : "text-rose-500"}>
              {c.points >= 0 ? "+" : ""}{c.points.toFixed(0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}