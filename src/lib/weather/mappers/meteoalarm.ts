import type { WeatherAlert } from "../types";
import { capSeverityToAlert, capSeverityToLevel } from "@/lib/weather/thresholds/warn-level";
import type { MeteoAlarmRaw } from "../sources/meteoalarm.functions";

/**
 * MeteoAlarm-Legacy-Atom liefert keine EMMA-Codes als Parameter, sondern
 * einen sprechenden Event-Text ("Yellow Thunderstorm Warning"). Wir mappen
 * Schlüsselwörter auf deutsche Hazard-Labels.
 */
const HAZARD_KEYWORDS: Array<{ match: RegExp; label: string; code: number }> = [
  { match: /thunder/i, label: "Gewitter", code: 3 },
  { match: /wind|gale/i, label: "Wind", code: 1 },
  { match: /rain|precip/i, label: "Regen", code: 10 },
  { match: /flood/i, label: "Hochwasser", code: 11 },
  { match: /snow|ice|glaze|frost/i, label: "Schnee/Glätte", code: 2 },
  { match: /avalanche/i, label: "Lawinen", code: 9 },
  { match: /fog/i, label: "Nebel", code: 4 },
  { match: /high[-\s]?temp|heat/i, label: "Hohe Temperaturen", code: 5 },
  { match: /low[-\s]?temp|cold/i, label: "Tiefe Temperaturen", code: 6 },
  { match: /coast/i, label: "Küstenereignis", code: 7 },
  { match: /forest[-\s]?fire|wildfire/i, label: "Waldbrand", code: 8 },
];

function deriveHazard(event: string): { label: string; code?: number } {
  for (const h of HAZARD_KEYWORDS) if (h.match.test(event)) return { label: h.label, code: h.code };
  return { label: event || "Wetterwarnung" };
}

export function mapMeteoAlarm(raw: MeteoAlarmRaw[]): WeatherAlert[] {
  return raw.map((a) => {
    const hazard = deriveHazard(a.event);
    return {
      id: a.id,
      headline: a.headline ?? (a.areaDesc ? `${hazard.label} — ${a.areaDesc}` : hazard.label),
      description: a.description,
      instruction: a.instruction,
      severity: capSeverityToAlert(a.severity),
      warnLevel: capSeverityToLevel(a.severity),
      event: hazard.label,
      eventCode: hazard.code,
      onset: a.onset ?? new Date().toISOString(),
      expires: a.expires ?? new Date(Date.now() + 6 * 3600_000).toISOString(),
      source: "meteoalarm",
      area: a.areaDesc,
    };
  });
}