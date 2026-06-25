import { HourlyStrip } from "@/components/dashboard/HourlyStrip";
import { DailyStrip } from "@/components/dashboard/DailyStrip";
import type { ForecastBundle } from "@/lib/weather/types";

/**
 * Nachgelagerter Trendbereich: kompakter 24 h-Strip + 7-Tage-Trend mit
 * Gefahren-Pillen pro Tag. Bewusst tertiär, keine eigene Hero-Optik.
 */
export function TrendStrip({ bundle }: { bundle: ForecastBundle }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <HourlyStrip bundle={bundle} />
      </div>
      <div className="lg:col-span-5">
        <DailyStrip bundle={bundle} />
      </div>
    </div>
  );
}
