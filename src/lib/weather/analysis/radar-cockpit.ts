/**
 * Analyse-Logik für die Cockpit-Analyseleiste.
 * Bewusst defensiv: lieber "keine Live-Bestätigung" als geraten.
 */
import type { WmsTimeline } from "@/lib/weather/sources/dwd-wms";

export type Confidence = "ok" | "delayed" | "degraded" | "missing";

export interface SourceHealth {
  label: string;
  confidence: Confidence;
  detail: string;
}

export function assessTimeline(
  name: string,
  t: WmsTimeline | undefined,
  expectedMinutes: number,
): SourceHealth {
  if (!t || !t.latest) return { label: name, confidence: "missing", detail: "keine Daten" };
  const lagMin = (t.lagMs ?? 0) / 60_000;
  const expectedMs = expectedMinutes * 60_000;
  let confidence: Confidence = "ok";
  if (t.gaps > 0) confidence = "degraded";
  else if ((t.lagMs ?? 0) > expectedMs * 3) confidence = "delayed";
  else if ((t.lagMs ?? 0) > expectedMs * 1.5) confidence = "delayed";
  const lagText = `${lagMin.toFixed(0)} min alt`;
  const gapText = t.gaps > 0 ? `, ${t.gaps} Lücke${t.gaps === 1 ? "" : "n"}` : "";
  return { label: name, confidence, detail: `${lagText}${gapText}` };
}