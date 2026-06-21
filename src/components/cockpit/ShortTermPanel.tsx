import { Card } from "@/components/ui/card";
import { NowcastPanel } from "@/components/dashboard/NowcastPanel";
import { TendencyBadge, deriveTendency } from "./TendencyBadge";
import { useLiveNow } from "@/hooks/use-live-now";
import { buildNowcast2h } from "@/lib/weather/analysis/nowcast";
import { severeScore } from "@/lib/weather/analysis/convection";
import type { ForecastBundle } from "@/lib/weather/types";

/**
 * Wrapper für die bestehende `NowcastPanel`-Logik mit Tendenz-Badge oben rechts
 * und Konsistenz-Hinweis Radar vs. Modell (heuristisch).
 */
export function ShortTermPanel({ bundle }: { bundle: ForecastBundle }) {
  const now = useLiveNow();
  const nc = buildNowcast2h(bundle.hourly, bundle.minutely, now);
  const live = bundle.hourly[0] ? severeScore(bundle.hourly[0]).value : 0;
  const tendency = deriveTendency(live, nc.peakScore);

  const consistency = describeConsistency(nc.confidence, Math.abs(nc.peakScore - live));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0 text-[12px] text-muted-foreground">{consistency}</div>
        <TendencyBadge tendency={tendency} />
      </div>
      <Card className="p-0">
        <NowcastPanel bundle={bundle} />
      </Card>
    </div>
  );
}

function describeConsistency(conf: "niedrig" | "mittel" | "hoch", delta: number): string {
  if (conf === "hoch" && delta < 10) return "Radar (Minutely) und Modell decken sich gut.";
  if (conf === "hoch") return "Radar zeigt Abweichung zum Modelltrend, beobachten.";
  if (conf === "mittel") return "Eingeschränkte Datenlage, Konsistenz nur teilweise prüfbar.";
  return "Schwache Datenlage, Aussagen mit Vorsicht behandeln.";
}