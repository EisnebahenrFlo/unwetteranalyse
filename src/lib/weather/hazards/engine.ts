/**
 * Hazard-Engine: kombiniert Storm-Zellen mit den drei Diagnosen.
 * Bewusst rein funktional, damit der React-Hook nur den State hält.
 */

import type { StormCell } from "@/lib/weather/storm/types";
import { diagnoseHail } from "./hail";
import { diagnoseFlood } from "./flood";
import { diagnoseLightning } from "./lightning";
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

    // Strike-Zeiten der Zelle aus der History rekonstruieren — wir haben sie
    // im aktuellen Storm-Modell nicht direkt, nutzen also Cell-History +
    // aktuelle Rate als Proxy. Genug Substanz für σ-Vergleich.
    const strikeTimes = synthStrikeTimes(cell);

    const lightning = diagnoseLightning({
      strikeTimes,
      currentRatePerMin: cell.strikeRatePerMin,
    });

    const hail = diagnoseHail({
      strikeRatePerMin: cell.strikeRatePerMin,
      strikeCount: cell.strikeCount,
      radiusKm: cell.radiusKm,
      cape: envSample?.cape ?? null,
      liftedIndex: envSample?.liftedIndex ?? null,
      freezingLevelM: precipSample?.freezingLevelM ?? null,
      jumpActive: lightning.jumpActive,
    });

    const flood = diagnoseFlood({
      rrH1: precipSample?.rrH1 ?? null,
      rrH3: precipSample?.rrH3 ?? null,
      rrH6: precipSample?.rrH6 ?? null,
      rrH24: precipSample?.rrH24 ?? null,
      validFor: precipSample?.validFor ?? undefined,
    });

    const topLevel = maxLevel([hail.level, flood.level, lightning.level]);
    const topScore = Math.max(hail.score, flood.score, lightning.score);

    return { cellId: cell.id, topLevel, topScore, hail, flood, lightning };
  });
}

/**
 * Rekonstruiert plausible Strike-Zeitstempel aus der Cell-History:
 * Pro History-Punkt wird die dort gemessene Strike-Zahl gleichmäßig über
 * das Zeitintervall zum vorigen Punkt verteilt. Reicht für σ-Statistik.
 */
function synthStrikeTimes(cell: StormCell): number[] {
  const out: number[] = [];
  const hist = cell.history;
  if (hist.length === 0) return out;
  for (let i = 0; i < hist.length; i++) {
    const p = hist[i];
    const prev = i > 0 ? hist[i - 1] : null;
    const start = prev ? prev.time : p.time - 60_000;
    const span = Math.max(1, p.time - start);
    const n = Math.max(0, p.strikes);
    if (n === 0) continue;
    for (let k = 0; k < n; k++) {
      out.push(start + ((k + 0.5) / n) * span);
    }
  }
  return out;
}
