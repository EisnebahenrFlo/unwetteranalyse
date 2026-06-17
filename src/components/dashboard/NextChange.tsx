import { DataCard } from "@/components/common/DataCard";
import { ArrowRight } from "lucide-react";
import { formatHour, formatRelative } from "@/lib/weather/format";
import type { ForecastBundle } from "@/lib/weather/types";
import { findNextChange } from "@/lib/weather/analysis/situation";
import { useLiveNow } from "@/hooks/use-live-now";

export function NextChange({ bundle }: { bundle: ForecastBundle }) {
  useLiveNow();
  const change = findNextChange(bundle.hourly);
  return (
    <DataCard title="Nächster Wetterumschwung" meta={bundle.meta}>
      {change ? (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-sm text-foreground">
            <ArrowRight className="h-4 w-4 text-primary" />
            <span className="min-w-0 truncate">{change.summary}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatHour(change.at)} · {formatRelative(change.at)}
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">In den nächsten 24 Stunden keine markante Änderung erkennbar.</div>
      )}
    </DataCard>
  );
}
