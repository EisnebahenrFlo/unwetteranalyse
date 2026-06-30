import { useLiveNow } from "@/hooks/use-live-now";
import { cn } from "@/lib/utils";

interface Entry {
  label: string;
  updatedAt?: string;
  /** Schwelle in Minuten, ab der die Quelle als „verzögert" gilt. */
  warnAfterMin?: number;
  ok?: boolean;
}

/**
 * Kompakter Datenstand-Streifen, der oben auf dem Dashboard sitzt.
 * Antwort auf eine einfache Frage: „Wie frisch sind meine Daten gerade?".
 * Pro Quelle: Label, Alter in Minuten, Farbcode (ok/verzögert/aus).
 */
export function DataFreshnessStrip({ entries }: { entries: Entry[] }) {
  const now = useLiveNow();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/70 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground">
      <span className="font-semibold uppercase tracking-wider text-foreground/80">Datenstand</span>
      {entries.map((e) => {
        const ageMin = e.updatedAt
          ? Math.max(0, Math.round((now.getTime() - new Date(e.updatedAt).getTime()) / 60_000))
          : null;
        const warn = e.warnAfterMin ?? 30;
        const state: "ok" | "delayed" | "off" =
          e.ok === false || !e.updatedAt
            ? "off"
            : ageMin != null && ageMin > warn
              ? "delayed"
              : "ok";
        return (
          <span key={e.label} className="inline-flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", DOT[state])} aria-hidden />
            <span className="text-foreground/80">{e.label}</span>
            <span className="font-mono tabular-nums">
              {ageMin == null ? "—" : ageMin === 0 ? "jetzt" : `vor ${ageMin} min`}
            </span>
          </span>
        );
      })}
    </div>
  );
}

const DOT: Record<"ok" | "delayed" | "off", string> = {
  ok: "bg-primary",
  delayed: "bg-muted-foreground",
  off: "bg-destructive",
};
