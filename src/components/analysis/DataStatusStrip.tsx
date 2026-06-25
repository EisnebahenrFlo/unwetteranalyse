import { cn } from "@/lib/utils";

export interface DataStatus {
  label: string;
  source: string;
  ageMinutes?: number | null;
  ok: boolean;
  note?: string;
}

export function DataStatusStrip({ items }: { items: DataStatus[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.map((i) => (
        <Cell key={i.label} item={i} />
      ))}
    </div>
  );
}

function Cell({ item }: { item: DataStatus }) {
  const dot = item.ok ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div className="rounded-md border border-border bg-background/60 px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <span className={cn("inline-block h-2 w-2 rounded-full", dot)} />
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {item.label}
        </div>
      </div>
      <div className="font-mono text-xs text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
        {item.source}
      </div>
      <div className="text-[10.5px] text-muted-foreground">
        {item.ageMinutes != null
          ? `${Math.round(item.ageMinutes)} min alt`
          : (item.note ?? (item.ok ? "verfügbar" : "fehlt"))}
      </div>
    </div>
  );
}
