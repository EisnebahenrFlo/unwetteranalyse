import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tendency = "sharpening" | "stable" | "easing";

const STYLES: Record<Tendency, { label: string; cls: string; icon: typeof ArrowRight }> = {
  sharpening: { label: "verschärft sich", cls: "border-warn-severe/50 bg-warn-severe/10 text-warn-severe", icon: ArrowUpRight },
  stable:     { label: "stabil",         cls: "border-border bg-muted/40 text-muted-foreground",         icon: ArrowRight },
  easing:     { label: "entspannt sich", cls: "border-primary/40 bg-primary/10 text-primary",            icon: ArrowDownRight },
};

export function TendencyBadge({ tendency, className }: { tendency: Tendency; className?: string }) {
  const s = STYLES[tendency];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium", s.cls, className)}>
      <Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}

/**
 * Tendenz aus Live-Score und Nowcast-Peak ableiten.
 */
export function deriveTendency(liveScore: number, nowcastPeak: number): Tendency {
  const delta = nowcastPeak - liveScore;
  if (delta >= 12) return "sharpening";
  if (delta <= -12) return "easing";
  return "stable";
}