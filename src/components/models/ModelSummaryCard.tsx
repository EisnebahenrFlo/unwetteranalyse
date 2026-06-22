import { Card } from "@/components/ui/card";
import type { ConsensusSummary } from "@/lib/weather/analysis/model-consensus";
import { useLiveNow } from "@/hooks/use-live-now";
import { formatRelative } from "@/lib/weather/format";
import { cn } from "@/lib/utils";

function fmtHourRange(window: ConsensusSummary["signalWindow"]) {
  if (!window) return "kein klares Hauptsignal";
  const s = new Date(window.start).toLocaleTimeString("de-DE", { hour: "2-digit" });
  const e = new Date(window.end).toLocaleTimeString("de-DE", { hour: "2-digit" });
  return `Hauptsignal ${s}–${e} Uhr`;
}

function riskLabel(v: number) {
  if (v >= 70) return { label: "Unwetter", tone: "severe" as const };
  if (v >= 45) return { label: "Markant", tone: "moderate" as const };
  if (v >= 20) return { label: "Erhöht", tone: "minor" as const };
  return { label: "Ruhig", tone: "calm" as const };
}

const TONE_DOT: Record<string, string> = {
  severe: "bg-warn-severe",
  moderate: "bg-warn-moderate",
  minor: "bg-warn-minor",
  calm: "bg-muted-foreground/40",
};

export function ModelSummaryCard({ summary, updatedAt }: { summary: ConsensusSummary; updatedAt?: string }) {
  const now = useLiveNow();
  const risk = riskLabel(summary.riskMax);
  const consensusPct = Math.round(summary.signalingRatio * 100);
  const uncLabel = summary.uncertainty === "low" ? "gering" : summary.uncertainty === "mid" ? "mittel" : "erhöht";
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Modelllage auf einen Blick</div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full", TONE_DOT[risk.tone])} />
          {risk.label}
        </div>
      </div>

      <p className="text-[15px] leading-snug text-foreground">{summary.headline}</p>

      <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
        <KPI label="Risiko" value={`${summary.riskMax}`} sub={risk.label} tone={risk.tone} />
        <KPI label="Modell-Konsens" value={`${summary.signalingCount}/${summary.modelCount}`} sub={`${consensusPct} %`} />
        <KPI label="Unsicherheit" value={uncLabel} sub={`Δ ${Math.round(summary.scoreSpread)}`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{fmtHourRange(summary.signalWindow)}</span>
        {updatedAt && <span>Aktualisiert {formatRelative(new Date(updatedAt) > now ? now.toISOString() : updatedAt)}</span>}
      </div>
    </Card>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="truncate text-lg font-semibold tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
      </div>
      {sub && (
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {tone && <span className={cn("inline-block h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} />}
          <span className="truncate">{sub}</span>
        </div>
      )}
    </div>
  );
}
