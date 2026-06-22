import { Card } from "@/components/ui/card";
import type { ConsensusSummary } from "@/lib/weather/analysis/model-consensus";
import { cn } from "@/lib/utils";

export function ConsensusPanel({ summary }: { summary: ConsensusSummary }) {
  const pct = Math.round(summary.signalingRatio * 100);
  const windowLabel = summary.signalWindow
    ? `${new Date(summary.signalWindow.start).toLocaleTimeString("de-DE", { hour: "2-digit" })}–${new Date(summary.signalWindow.end).toLocaleTimeString("de-DE", { hour: "2-digit" })} Uhr`
    : "kein klares Fenster";
  const uncLabel = summary.uncertainty === "low" ? "gering" : summary.uncertainty === "mid" ? "mittel" : "erhöht";
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Modell-Konsens</h2>
        <span className="text-[11px] text-muted-foreground">24-h-Fenster</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Chip primary={`${summary.signalingCount} / ${summary.modelCount}`} label="Modelle mit Signal" />
        <Chip primary={windowLabel} label="Höchste Übereinstimmung" />
        <Chip primary={uncLabel} label={`Spread Δ ${Math.round(summary.scoreSpread)}`} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Übereinstimmung</span>
          <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{pct} %</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 70 ? "bg-foreground" : pct >= 40 ? "bg-foreground/70" : "bg-foreground/40",
            )}
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

function Chip({ primary, label }: { primary: string; label: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="truncate text-sm font-semibold tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
        {primary}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
