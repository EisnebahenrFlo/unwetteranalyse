import { bandColorClass, bandLabel, confidenceLabel } from "@/lib/weather/scoring/labels";
import type { Band } from "@/lib/weather/scoring/labels";
import { cn } from "@/lib/utils";

/**
 * Hauptblock für Nowcast und Tagesbewertung.
 * Zeigt Score, Band, Peak und Confidence sehr klar.
 */
export function ScoreHeadline({
  score, band, headline, peakLabel, confidence, dataConfidence, footer,
}: {
  score: number;
  band: Band;
  headline: string;
  peakLabel?: string;
  confidence?: "niedrig" | "mittel" | "hoch";
  dataConfidence: number;
  footer?: string;
}) {
  const c = bandColorClass(band);
  const confKey = confidence ?? confidenceLabel(dataConfidence);
  return (
    <div className={cn("rounded-xl border p-4", c.border, c.soft)}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
        <div className="flex flex-col items-center justify-center rounded-lg bg-background/70 px-3 py-2 text-center">
          <div className="font-mono text-4xl font-semibold leading-none tabular-nums text-foreground" style={{ fontFamily: "var(--font-mono)" }}>{score}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">/100</div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", c.bg, c.text)}>
              {bandLabel(band)}
            </span>
            {peakLabel && <span className="text-[11px] font-mono text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>Peak {peakLabel}</span>}
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">{headline}</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/80">
              <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.max(4, dataConfidence)}%` }} />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              Vertrauen {confKey} · {dataConfidence}/100
            </span>
          </div>
          {footer && <div className="mt-1 text-[11px] text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}