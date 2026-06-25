/**
 * Hazard-Engine: kombiniert Storm-Zellen mit Hagel- und Sturzflut-Diagnose.
 */

import type { StormCell } from "@/lib/weather/storm/types";
import { diagnoseHail } from "./hail";
import { diagnoseFlood } from "./flood";
import { HAZARD_RANK, type HazardCellReport, type HazardLevel } from "./types";
import type { CellEnvSample } from "@/lib/weather/storm/environment";
import { gridKey } from "@/lib/weather/storm/environment";
import { type CellPrecipSample, precipKey } from "./precipitation";

function maxLevel(levels: HazardLevel[]): HazardLevel {
  return levels.reduce<HazardLevel>(
    (acc, l) => (HAZARD_RANK[l] > HAZARD_RANK[acc] ? l : acc),
    "none",
  );
}

export function buildHazardReports(
  cells: StormCell[],
  env: Map<string, CellEnvSample>,
  precip: Map<string, CellPrecipSample>,
): HazardCellReport[] {
  return cells.map((cell) => {
    const envSample = env.get(gridKey(cell.centroid.lat, cell.centroid.lon));
    const precipSample = precip.get(precipKey(cell.centroid.lat, cell.centroid.lon));

    const hail = diagnoseHail({
      topDbz: cell.topDbz,
      hailCoreAreaKm2: cell.hailCoreAreaKm2,
      areaKm2: cell.areaKm2,
      cape: envSample?.cape ?? null,
      liftedIndex: envSample?.liftedIndex ?? null,
      freezingLevelM: precipSample?.freezingLevelM ?? null,
    });

    const flood = diagnoseFlood({
      rrH1: precipSample?.rrH1 ?? null,
      rrH3: precipSample?.rrH3 ?? null,
      rrH6: precipSample?.rrH6 ?? null,
      rrH24: precipSample?.rrH24 ?? null,
      validFor: precipSample?.validFor ?? undefined,
    });

    const topLevel = maxLevel([hail.level, flood.level]);
    const topScore = Math.max(hail.score, flood.score);

    return { cellId: cell.id, topLevel, topScore, hail, flood };
  });
}