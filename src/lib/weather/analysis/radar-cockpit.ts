/**
 * Analyse-Logik für die Cockpit-Analyseleiste.
 * Bewusst defensiv: lieber "keine Live-Bestätigung" als geraten.
 */
import type { WmsTimeline } from "@/lib/weather/sources/dwd-wms";
import type { LightningStrike } from "@/lib/weather/sources/blitzortung";

export type Confidence = "ok" | "delayed" | "degraded" | "missing";

export interface SourceHealth {
  label: string;
  confidence: Confidence;
  detail: string;
}

export function assessTimeline(name: string, t: WmsTimeline | undefined, expectedMinutes: number): SourceHealth {
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

export interface LightningInsight {
  total: number;
  last5: number;
  prev5: number;
  trend: "rising" | "falling" | "steady" | "none";
  centroid: { lat: number; lon: number } | null;
  bearingFromUser: string | null;
}

export function analyseLightning(strikes: LightningStrike[], user?: { lat: number; lon: number }): LightningInsight {
  const now = Date.now();
  const last5 = strikes.filter((s) => now - s.time <= 5 * 60_000).length;
  const prev5 = strikes.filter((s) => {
    const age = now - s.time;
    return age > 5 * 60_000 && age <= 10 * 60_000;
  }).length;
  const trend: LightningInsight["trend"] =
    last5 === 0 && prev5 === 0 ? "none" : last5 > prev5 + 2 ? "rising" : prev5 > last5 + 2 ? "falling" : "steady";

  let centroid: LightningInsight["centroid"] = null;
  const recent = strikes.filter((s) => now - s.time <= 15 * 60_000);
  if (recent.length > 0) {
    const lat = recent.reduce((a, s) => a + s.lat, 0) / recent.length;
    const lon = recent.reduce((a, s) => a + s.lon, 0) / recent.length;
    centroid = { lat, lon };
  }
  const bearingFromUser = centroid && user ? compass(bearing(user, centroid)) : null;
  return { total: strikes.length, last5, prev5, trend, centroid, bearingFromUser };
}

function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function compass(deg: number) {
  const dirs = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}