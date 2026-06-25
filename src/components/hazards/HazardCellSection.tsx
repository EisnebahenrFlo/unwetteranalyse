import { CloudHail, CloudRain } from "@/components/icons";
import type { HazardCellReport, HazardDiagnosis, HazardKind } from "@/lib/weather/hazards/types";
import { cn } from "@/lib/utils";
import { HAZARD_KIND_LABEL, HAZARD_LEVEL_LABEL, HAZARD_LEVEL_TONE } from "./hazard-tokens";

const ICONS: Record<HazardKind, React.ElementType> = {
  hail: CloudHail,
  flood: CloudRain,
};

export function HazardCellSection({ report }: { report: HazardCellReport | null }) {
  if (!report) return null;
  const items: { kind: HazardKind; diag: HazardDiagnosis; metric: string | null }[] = [
    {
      kind: "hail",
      diag: report.hail,
      metric:
        report.hail.meshsCm > 0
          ? `MESHS ≈ ${report.hail.meshsCm.toFixed(1)} cm`
          : report.hail.pohPercent > 0
            ? `POH ${report.hail.pohPercent} %`
            : null,
    },
    {
      kind: "flood",
      diag: report.flood,
      metric:
        report.flood.returnYears != null
          ? `T≈${report.flood.returnYears}a · ${Math.round(report.flood.rrMm.h3)} mm/3 h`
          : Math.max(report.flood.rrMm.h1, report.flood.rrMm.h3) > 0
            ? `${Math.round(report.flood.rrMm.h3)} mm/3 h`
            : null,
    },
  ];

  return (
    <div className="grid gap-2">
      {items.map(({ kind, diag, metric }) => {
        const Icon = ICONS[kind];
        return (
          <div key={kind} className="rounded-lg border border-border/60 bg-card">
            <header className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{HAZARD_KIND_LABEL[kind]}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {metric && (
                  <span className="font-mono text-[11px] text-muted-foreground">{metric}</span>
                )}
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                    HAZARD_LEVEL_TONE[diag.level],
                  )}
                >
                  {HAZARD_LEVEL_LABEL[diag.level]} · {diag.score}
                </span>
              </div>
            </header>
            <div className="px-3 py-2">
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                {diag.reasons.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
              {diag.sources.length > 0 && (
                <p className="mt-1.5 text-[10px] text-muted-foreground/80">
                  Quellen: {diag.sources.map((s) => s.label).join(" · ")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}