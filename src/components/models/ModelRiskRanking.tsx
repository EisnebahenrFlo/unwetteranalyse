import { useState } from "react";
import { Card } from "@/components/ui/card";
import { WarnBadge } from "@/components/common/WarnBadge";
import { ChevronRight } from "lucide-react";
import type { ModelRankRow } from "@/lib/weather/analysis/model-consensus";
import { ModelDetailDrawer } from "./ModelDetailDrawer";
import { cn } from "@/lib/utils";

function tone(score: number) {
  if (score >= 70) return "bg-warn-severe";
  if (score >= 45) return "bg-warn-moderate";
  if (score >= 20) return "bg-warn-minor";
  return "bg-muted-foreground/40";
}

export function ModelRiskRanking({ rows }: { rows: ModelRankRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.model === openId) ?? null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <Card key={r.model} className="overflow-hidden p-0">
            <button
              type="button"
              onClick={() => setOpenId(r.model)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{r.label}</span>
                  {r.level !== "none" && <WarnBadge severity={r.level} />}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", tone(r.worstScore))} style={{ width: `${Math.max(4, r.worstScore)}%` }} />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    {r.worstScore}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.drivers.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">keine Treiber</span>
                  )}
                  {r.drivers.map((d) => (
                    <span key={d} className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </Card>
        ))}
      </div>
      <ModelDetailDrawer row={open} open={!!open} onOpenChange={(v) => !v && setOpenId(null)} />
    </>
  );
}
