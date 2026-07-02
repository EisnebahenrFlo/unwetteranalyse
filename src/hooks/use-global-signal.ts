import { useQuery } from "@tanstack/react-query";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { weatherAlertsQuery } from "@/lib/weather/queries";
import {
  alertSeverityToLevel,
  type SeverityLevel,
} from "@/components/common/SeverityRail";

export interface GlobalSignal {
  level: SeverityLevel | null;
  updatedAt: string | null;
  source: string;
}

/**
 * Globales Signal für die persistente AppShell-Signatur (SeverityRail + DataFreshness).
 * Konsumiert ausschließlich die bestehende offizielle Warnungen-Query (Bright Sky / DWD).
 * Keine eigene Severity-Berechnung — nutzt `alertSeverityToLevel` als Single Source.
 */
export function useGlobalSignal(): GlobalSignal {
  const point = useActivePoint();
  const query = useQuery(weatherAlertsQuery(point));

  const alerts = query.data ?? [];
  let level: SeverityLevel | null = null;
  for (const a of alerts) {
    const lvl = alertSeverityToLevel(a.severity);
    if (level == null || lvl > level) level = lvl;
  }

  const updatedAt = query.dataUpdatedAt
    ? new Date(query.dataUpdatedAt).toISOString()
    : null;

  const hasMeteoalarm = alerts.some((a) => a.source === "meteoalarm");
  return { level, updatedAt, source: hasMeteoalarm ? "MeteoAlarm" : "DWD" };
}