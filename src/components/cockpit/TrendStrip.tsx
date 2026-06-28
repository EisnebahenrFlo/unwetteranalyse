import { HourlyStrip } from "@/components/dashboard/HourlyStrip";
import { DailyStrip } from "@/components/dashboard/DailyStrip";
import type { ForecastBundle } from "@/lib/weather/types";

/**
 * Nachgelagerter Trendbereich: kompakter 24 h-Strip + 7-Tage-Trend mit
 * Gefahren-Pillen pro Tag. Bewusst tertiär, keine eigene Hero-Optik.
 */
export function TrendStrip({ bundle }: { bundle: ForecastBundle }) {
  return (
    <div className="flex flex-col gap-3">
      <HourlyStrip bundle={bundle} />
      <DailyStrip bundle={bundle} />
    </div>
  );
}
