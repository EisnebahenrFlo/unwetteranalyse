import type { DataMeta as DataMetaT } from "@/lib/weather/types";
import { formatRelative } from "@/lib/weather/format";
import { useLiveNow } from "@/hooks/use-live-now";

const SOURCE_LABEL: Record<DataMetaT["source"], string> = {
  "open-meteo": "Open-Meteo",
  "bright-sky": "Bright Sky / DWD",
  "dwd": "DWD-Schwellen",
};

export function DataMeta({ meta }: { meta: DataMetaT }) {
  const now = useLiveNow();
  const updatedAt = new Date(meta.updatedAt) > now ? now.toISOString() : meta.updatedAt;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span>Quelle: {SOURCE_LABEL[meta.source]}</span>
      <span>Stand: {formatRelative(updatedAt)}</span>
      {meta.resolutionKm != null && <span>Auflösung ≈ {meta.resolutionKm} km</span>}
      {meta.uncertainty && <span title={meta.uncertainty}>· Unsicherheit</span>}
    </div>
  );
}
