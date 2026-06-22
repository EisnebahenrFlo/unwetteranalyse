import { cn } from "@/lib/utils";
import type { ConsensusMetric } from "@/lib/weather/analysis/model-consensus";

export interface ParamOption {
  id: ConsensusMetric;
  label: string;
  unit: string;
}

export const PARAMETERS: ParamOption[] = [
  { id: "temperatureC", label: "Temperatur", unit: "°C" },
  { id: "dewPointC", label: "Taupunkt", unit: "°C" },
  { id: "precipitationMm", label: "Niederschlag", unit: "mm/h" },
  { id: "precipitationProbability", label: "Regenchance", unit: "%" },
  { id: "windGustMs", label: "Böen", unit: "m/s" },
  { id: "cape", label: "CAPE", unit: "J/kg" },
  { id: "liftedIndex", label: "Lifted Index", unit: "K" },
];

interface Props {
  active: ConsensusMetric;
  onChange: (m: ConsensusMetric) => void;
}

export function ParameterFilterStrip({ active, onChange }: Props) {
  return (
    <div className="sticky top-0 z-30 -mx-4 border-y border-border/60 bg-background/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:-mx-5 md:px-5">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PARAMETERS.map((p) => {
          const isActive = p.id === active;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
