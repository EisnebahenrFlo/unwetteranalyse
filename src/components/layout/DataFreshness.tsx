import { cn } from "@/lib/utils";
import { useLiveNow } from "@/hooks/use-live-now";

interface Props {
  /** ISO-Zeitstempel der jüngsten Datenaktualisierung. Optional. */
  updatedAt?: string | null;
  /** Quellen-Label, z. B. „DWD" oder „Open-Meteo". Optional. */
  source?: string;
  className?: string;
}

/**
 * Globaler Datenfrische-Chip im Header.
 * Präsentational: ohne `updatedAt` zeigt der Chip neutralen Default,
 * niemals erfundene Zeitwerte.
 */
export function DataFreshness({ updatedAt, source, className }: Props) {
  const now = useLiveNow();
  const ageMin = updatedAt
    ? Math.max(0, Math.round((now.getTime() - new Date(updatedAt).getTime()) / 60_000))
    : null;
  const ageLabel = ageMin == null ? "–" : ageMin === 0 ? "jetzt" : `vor ${ageMin} Min`;
  const dot =
    ageMin == null ? "bg-muted-foreground/60" : ageMin > 30 ? "bg-warn-minor" : "bg-primary";

  return (
    <div
      className={cn(
        "hidden items-center gap-2 rounded-full border border-border bg-card/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline-flex",
        className,
      )}
      title={updatedAt ? `Letztes Update: ${new Date(updatedAt).toLocaleString("de-DE")}` : undefined}
    >
      <span className={cn("relative h-1.5 w-1.5 rounded-full", dot)} aria-hidden>
        {ageMin != null && ageMin <= 30 && (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/70 motion-reduce:hidden" />
        )}
      </span>
      <span className="text-foreground/80">Stand</span>
      <span className="tabular-nums">· {ageLabel}</span>
      {source && <span className="text-muted-foreground/80">· {source}</span>}
    </div>
  );
}