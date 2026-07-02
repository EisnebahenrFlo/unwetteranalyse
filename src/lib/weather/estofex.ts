import type { EstofexForecast } from "./sources/estofex.functions";
import { pointInPolygon } from "./geo/point-in-polygon";

export type EstofexLevel = 0 | 1 | 2 | 3;

/** Höchstes Level, in dessen Ringen der Punkt liegt. 0 = außerhalb. */
export function estofexLevelAt(fc: EstofexForecast, lon: number, lat: number): EstofexLevel {
  let max: EstofexLevel = 0;
  for (const l of fc.levels) {
    if (l.rings.some((r) => pointInPolygon(lon, lat, r)) && l.level > max) {
      max = l.level;
    }
  }
  return max;
}

/** Forecast noch gültig (validTo > jetzt). */
export function estofexIsCurrent(fc: EstofexForecast, now: Date): boolean {
  if (!fc.validTo) return false;
  return new Date(fc.validTo).getTime() > now.getTime();
}