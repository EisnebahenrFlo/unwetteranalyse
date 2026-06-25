import { DataCard } from "@/components/common/DataCard";
import { InfoPopover } from "@/components/common/InfoPopover";
import { cn } from "@/lib/utils";

export function ParamCardPro({
  title,
  info,
  value,
  unit,
  derived,
  interpretation,
  band,
}: {
  title: string;
  info?: { title: string; text: string };
  value: string;
  unit?: string;
  derived?: { label: string; value: string };
  interpretation?: string;
  band?: "ruhig" | "aufmerksam" | "markant" | "kritisch" | "hochkritisch";
}) {
  const bandColor =
    band === "hochkritisch"
      ? "text-warn-extreme"
      : band === "kritisch"
        ? "text-warn-severe"
        : band === "markant"
          ? "text-warn-moderate"
          : band === "aufmerksam"
            ? "text-warn-minor"
            : "text-muted-foreground";
  return (
    <DataCard
      title={title}
      action={info ? <InfoPopover title={info.title}>{info.text}</InfoPopover> : undefined}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono text-2xl font-semibold tabular-nums text-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {value}
          </span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {derived && (
          <div className="flex items-baseline justify-between rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px]">
            <span className="uppercase tracking-wide text-muted-foreground">{derived.label}</span>
            <span
              className="font-mono font-semibold tabular-nums text-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {derived.value}
            </span>
          </div>
        )}
        {interpretation && <div className={cn("text-[11px]", bandColor)}>{interpretation}</div>}
      </div>
    </DataCard>
  );
}
