import { useState } from "react";
import { ChevronDown } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/weather/format";
import { useLiveNow } from "@/hooks/use-live-now";
import type { DataMeta } from "@/lib/weather/types";

export interface SourceEntry {
  id: string;
  label: string;
  description: string;
  meta?: DataMeta;
  ok: boolean;
  note?: string;
}

/**
 * Tertiärer System-Status: zeigt Quellen, Stand, Verzögerung, Hinweise.
 * Default kollabiert. Status-Indikator: grün/gelb/rot.
 */
export function SystemStatus({
  entries,
  defaultOpen = false,
}: {
  entries: SourceEntry[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const now = useLiveNow();
  const status = overallStatus(entries, now);

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
        aria-expanded={open}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[status])} aria-hidden />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-foreground">
            Datenquellen & System
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {entries.length} Quellen · Status {STATUS_LABEL[status]}
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="grid divide-y divide-border/60 border-t border-border">
          {entries.map((e) => (
            <Row key={e.id} entry={e} />
          ))}
        </div>
      )}
    </Card>
  );
}

function Row({ entry }: { entry: SourceEntry }) {
  const now = useLiveNow();
  const status = entryStatus(entry, now);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
      <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} aria-hidden />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-foreground">{entry.label}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {entry.description}
          {entry.note ? ` · ${entry.note}` : ""}
        </div>
      </div>
      <div className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {entry.meta?.updatedAt ? formatRelative(entry.meta.updatedAt) : "—"}
      </div>
    </div>
  );
}

type Status = "ok" | "delayed" | "off";

const STATUS_DOT: Record<Status, string> = {
  ok: "bg-primary",
  delayed: "bg-muted-foreground",
  off: "bg-destructive",
};
const STATUS_LABEL: Record<Status, string> = {
  ok: "ok",
  delayed: "verzögert",
  off: "nicht verfügbar",
};

function entryStatus(e: SourceEntry, now: Date): Status {
  if (!e.ok) return "off";
  if (!e.meta?.updatedAt) return "delayed";
  const ageMin = (now.getTime() - new Date(e.meta.updatedAt).getTime()) / 60_000;
  if (ageMin > 60) return "delayed";
  return "ok";
}
function overallStatus(entries: SourceEntry[], now: Date): Status {
  let worst: Status = "ok";
  for (const e of entries) {
    const s = entryStatus(e, now);
    if (s === "off") return "off";
    if (s === "delayed") worst = "delayed";
  }
  return worst;
}

/** Header-Pill für den schnellen Status-Blick. */
export function SystemStatusPill({
  entries,
  onJump,
}: {
  entries: SourceEntry[];
  onJump?: () => void;
}) {
  const now = useLiveNow();
  const status = overallStatus(entries, now);
  return (
    <button
      type="button"
      onClick={onJump}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      aria-label="Zum Systemstatus springen"
    >
      <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} aria-hidden />
      <span className="hidden sm:inline">{STATUS_LABEL[status]}</span>
    </button>
  );
}
