import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ShieldCheck } from "@/components/icons";
import type { WeatherAlert } from "@/lib/weather/types";
import { formatHour, formatRelative } from "@/lib/weather/format";
import { severityWeight } from "@/lib/weather/thresholds/dwd";
import { Link } from "@tanstack/react-router";
import { useLiveNow } from "@/hooks/use-live-now";

export function AlertsSummary({ alerts }: { alerts: WeatherAlert[] }) {
  useLiveNow();
  const sorted = [...alerts].sort(
    (a, b) => severityWeight(b.severity) - severityWeight(a.severity),
  );
  return (
    <DataCard
      title="Aktive Warnungen"
      subtitle={`${alerts.length} relevant in 48 h`}
      action={
        <Link to="/alerts" className="text-xs text-primary hover:underline">
          Alle
        </Link>
      }
    >
      {sorted.length === 0 ? (
        <EmptyState
          title="Keine aktiven Warnungen"
          description="Auch keine eigenen Schwellen ausgelöst."
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.slice(0, 3).map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-md border border-border bg-background/50 p-2.5"
            >
              <WarnBadge severity={a.severity} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{a.headline}</div>
                {a.description && (
                  <div className="line-clamp-2 text-[11px] text-muted-foreground">
                    {a.description}
                  </div>
                )}
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  ab {formatHour(a.onset)} · {formatRelative(a.onset)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DataCard>
  );
}
