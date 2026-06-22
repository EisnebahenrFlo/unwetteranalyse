/**
 * Diagnose-Schicht für das Radar-Cockpit.
 * Alle Funktionen sind reine Mappings. Keine Fetches, kein State.
 * Wo Daten fehlen, geben wir "unknown" zurück statt zu schätzen.
 */
import type { WmsTimeline } from "@/lib/weather/sources/dwd-wms";
import type { LightningStrike } from "@/lib/weather/sources/blitzortung";
import type { HourlyPoint } from "@/lib/weather/types";

export type Verdict = "ok" | "watch" | "alert" | "unknown";

export interface TriggerLight {
  moisture: Verdict;     // Feuchte
  instability: Verdict;  // CAPE / LI
  lift: Verdict;         // Hebung / Trigger (Wind, BL-Höhe, Druck)
  precipSignal: Verdict; // Niederschlagssignal Modell
  liveConfirm: Verdict;  // Live-Bestätigung (Blitz / Radar-Frame frisch)
  summary: string;
  score: number;         // 0..5 (Anzahl alert-Stufen, grob)
}

/**
 * Auslöser-Ampel: 5 Achsen, jede mit ok / watch / alert / unknown.
 * Schwellen sind absichtlich konservativ gewählt.
 */
export function triggerLight(input: {
  nowHour?: HourlyPoint;
  lightning5min: number;
  ryLagMs: number | null;
}): TriggerLight {
  const h = input.nowHour;

  const spread = h?.temperatureC != null && h?.dewPointC != null ? h.temperatureC - h.dewPointC : null;
  const moisture: Verdict =
    spread == null ? "unknown" : spread <= 3 ? "alert" : spread <= 6 ? "watch" : "ok";

  const cape = h?.cape ?? null;
  const li = h?.liftedIndex ?? null;
  const instability: Verdict =
    cape == null && li == null ? "unknown" :
    (cape != null && cape >= 1500) || (li != null && li <= -4) ? "alert" :
    (cape != null && cape >= 500) || (li != null && li <= -2) ? "watch" :
    "ok";

  // Hebung als Proxy aus Wind (Konvergenz), BL-Höhe, Druckanomalie.
  const gust = h?.windGustMs ?? null;
  const bl = h?.boundaryLayerHeightM ?? null;
  const lift: Verdict =
    gust == null && bl == null ? "unknown" :
    (gust != null && gust >= 18) || (bl != null && bl >= 2500) ? "alert" :
    (gust != null && gust >= 12) || (bl != null && bl >= 1500) ? "watch" :
    "ok";

  const prec = h?.precipitationMm ?? null;
  const pp = h?.precipitationProbability ?? null;
  const precipSignal: Verdict =
    prec == null && pp == null ? "unknown" :
    (prec != null && prec >= 2) || (pp != null && pp >= 70) ? "alert" :
    (prec != null && prec >= 0.3) || (pp != null && pp >= 40) ? "watch" :
    "ok";

  const radarFresh = input.ryLagMs != null && input.ryLagMs <= 15 * 60_000;
  const liveConfirm: Verdict =
    input.lightning5min === 0 && input.ryLagMs == null ? "unknown" :
    input.lightning5min >= 5 ? "alert" :
    input.lightning5min > 0 || (radarFresh && (prec ?? 0) >= 0.3) ? "watch" :
    "ok";

  const axes = [moisture, instability, lift, precipSignal, liveConfirm];
  const score = axes.filter((v) => v === "alert").length;
  const watches = axes.filter((v) => v === "watch").length;

  let summary = "Lage ruhig.";
  if (score >= 3) summary = "Mehrere Auslöser gleichzeitig aktiv.";
  else if (score >= 1) summary = "Einzelne Auslöser aktiv, beobachten.";
  else if (watches >= 2) summary = "Vorzeichen erkennbar, noch keine Auslösung.";

  return { moisture, instability, lift, precipSignal, liveConfirm, summary, score };
}

/* -------------------- Blitz gegen Radar -------------------- */

export type RadarLightningState =
  | "consistent"          // Echo + Blitze
  | "echo_no_lightning"   // Niederschlag aber keine Blitze
  | "lightning_no_echo"   // Blitze aber kein frisches/sichtbares Echo
  | "quiet"               // beides ruhig
  | "unknown";

export interface RadarLightningCheck {
  state: RadarLightningState;
  lightning15min: number;
  ryLagMin: number | null;
  echoLikely: boolean;
  detail: string;
}

/**
 * Vergleich Live-Blitze gegen Radar-Status.
 * Ohne Pixel-Sampling konservativ: Echo-Heuristik aus Modell-Niederschlag jetzt + Radar-Aktualität.
 */
export function blitzVsRadar(input: {
  strikes: LightningStrike[];
  ry: WmsTimeline | undefined;
  nowHourPrecipMm: number | null;
}): RadarLightningCheck {
  const now = Date.now();
  const lightning15min = input.strikes.filter((s) => now - s.time <= 15 * 60_000).length;
  const ryLagMs = input.ry?.lagMs ?? null;
  const ryLagMin = ryLagMs != null ? Math.round(ryLagMs / 60_000) : null;
  const ryFresh = ryLagMs != null && ryLagMs <= 15 * 60_000;
  const precipNow = input.nowHourPrecipMm ?? 0;
  const echoLikely = ryFresh && precipNow >= 0.3;

  let state: RadarLightningState;
  if (!input.ry || ryLagMs == null) state = lightning15min > 0 ? "lightning_no_echo" : "unknown";
  else if (echoLikely && lightning15min > 0) state = "consistent";
  else if (echoLikely && lightning15min === 0) state = "echo_no_lightning";
  else if (!echoLikely && lightning15min > 0) state = "lightning_no_echo";
  else state = "quiet";

  const detail = (() => {
    switch (state) {
      case "consistent": return "Radar-Echo und Blitze passen zusammen. Gewitteraktivität wahrscheinlich.";
      case "echo_no_lightning": return "Radar zeigt Niederschlag, aber keine Blitze. Wahrscheinlich Regen ohne Elektrik.";
      case "lightning_no_echo": return "Blitze ohne klar bestätigtes Echo. Entweder isoliert, Radarlücke oder Reichweite.";
      case "quiet": return "Keine Echos, keine Blitze.";
      default: return "Radar-Status unklar.";
    }
  })();

  return { state, lightning15min, ryLagMin, echoLikely, detail };
}

/* -------------------- Modell gegen Beobachtung -------------------- */

export type ModelObsState = "match" | "model_overcalls" | "model_underestimates" | "unknown";

export interface ModelObsCheck {
  state: ModelObsState;
  detail: string;
  modelExpectsConvection: boolean;
  observedConvection: boolean;
}

export function modelVsObservation(input: {
  nowHour?: HourlyPoint;
  lightning15min: number;
  ryFreshAndWet: boolean;
}): ModelObsCheck {
  const cape = input.nowHour?.cape ?? null;
  const li = input.nowHour?.liftedIndex ?? null;
  const pp = input.nowHour?.precipitationProbability ?? null;
  const modelExpectsConvection =
    (cape != null && cape >= 500) || (li != null && li <= -2) || (pp != null && pp >= 60);
  const observedConvection = input.lightning15min > 0 || input.ryFreshAndWet;

  let state: ModelObsState = "unknown";
  if (cape == null && pp == null && input.lightning15min === 0 && !input.ryFreshAndWet) state = "unknown";
  else if (modelExpectsConvection && observedConvection) state = "match";
  else if (modelExpectsConvection && !observedConvection) state = "model_overcalls";
  else if (!modelExpectsConvection && observedConvection) state = "model_underestimates";
  else state = "match";

  const detail = (() => {
    switch (state) {
      case "match": return "Modell und Beobachtung erzählen die gleiche Geschichte.";
      case "model_overcalls": return "Modell sieht konvektives Potenzial, Live-Signale bestätigen es nicht. Vorsichtig bewerten.";
      case "model_underestimates": return "Live-Signale zeigen Aktivität, die das Modell so nicht im Bild hat.";
      default: return "Nicht genug Datenbasis für Vergleich.";
    }
  })();

  return { state, detail, modelExpectsConvection, observedConvection };
}

/* -------------------- Zell-Tracking Light -------------------- */

export interface CellTrack {
  hasTrack: boolean;
  bearingDeg: number | null;        // Bewegungsrichtung der Aktivität (von älter → frischer)
  bearingCompass: string | null;
  speedKmh: number | null;
  distanceKm: number | null;        // Abstand frischer Schwerpunkt zum Fokus
  approachingFocus: boolean | null;
  etaMinutes: number | null;
  detail: string;
  /** Schwerpunkt der frischen Aktivität (0..10 min), falls vorhanden. */
  freshCentroid: { lat: number; lon: number } | null;
  /** Schwerpunkt der älteren Aktivität (10..30 min), falls vorhanden. */
  olderCentroid: { lat: number; lon: number } | null;
  /** Extrapolierte Position in +30 min entlang Bearing+Speed. */
  forecastPosition: { lat: number; lon: number; offsetMinutes: number } | null;
  /** Anzahl der frischen Treffer hinter dem Tracking. */
  sampleCount: number;
}

export function cellTracking(input: {
  strikes: LightningStrike[];
  focus: { lat: number; lon: number };
}): CellTrack {
  const now = Date.now();
  const fresh = input.strikes.filter((s) => now - s.time <= 10 * 60_000);
  const older = input.strikes.filter((s) => {
    const age = now - s.time;
    return age > 10 * 60_000 && age <= 30 * 60_000;
  });
  const cFreshEarly = centroid(fresh);
  // Schwelle bewusst weicher: bereits 2 frische + 2 ältere genügen für eine sinnvolle Vektor-Schätzung.
  if (fresh.length < 2 || older.length < 2) {
    return {
      hasTrack: false,
      bearingDeg: null, bearingCompass: null,
      speedKmh: null, distanceKm: distanceKm(cFreshEarly, input.focus),
      approachingFocus: null, etaMinutes: null,
      detail: fresh.length === 0 ? "Keine frische Blitzaktivität — kein Tracking möglich." : "Zu wenige Blitze für Tracking.",
      freshCentroid: cFreshEarly,
      olderCentroid: centroid(older),
      forecastPosition: null,
      sampleCount: fresh.length,
    };
  }
  const cFresh = centroid(fresh)!;
  const cOlder = centroid(older)!;
  const bearingDeg = bearing(cOlder, cFresh);
  const moveKm = haversineKm(cOlder, cFresh);
  // Zeitversatz ≈ 20 min (Mitte 30..10 min vs. 10..0 min).
  const speedKmh = (moveKm / 20) * 60;
  const distanceKm_ = distanceKm(cFresh, input.focus)!;
  const focusBearing = bearing(cFresh, input.focus);
  const dAngle = Math.abs(((bearingDeg - focusBearing + 540) % 360) - 180);
  const approachingFocus = dAngle <= 45;
  const etaMinutes = approachingFocus && speedKmh > 1 ? Math.round((distanceKm_ / speedKmh) * 60) : null;

  // Extrapolation: +30 min entlang Bearing & Speed.
  const forecastPosition =
    speedKmh > 1 ? projectPoint(cFresh, bearingDeg, (speedKmh / 60) * 30) : null;

  return {
    hasTrack: true,
    bearingDeg,
    bearingCompass: compass(bearingDeg),
    speedKmh,
    distanceKm: distanceKm_,
    approachingFocus,
    etaMinutes,
    detail: approachingFocus
      ? `Zelle zieht auf Fokus zu, ETA ${etaMinutes ?? "—"} min.`
      : "Zelle bewegt sich nicht klar auf den Fokus zu.",
    freshCentroid: cFresh,
    olderCentroid: cOlder,
    forecastPosition: forecastPosition
      ? { ...forecastPosition, offsetMinutes: 30 }
      : null,
    sampleCount: fresh.length,
  };
}

/* -------------------- Helper -------------------- */

function centroid(pts: { lat: number; lon: number }[]) {
  if (pts.length === 0) return null;
  const lat = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
  const lon = pts.reduce((a, p) => a + p.lon, 0) / pts.length;
  return { lat, lon };
}

function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function compass(deg: number) {
  const dirs = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function distanceKm(a: { lat: number; lon: number } | null, b: { lat: number; lon: number }) {
  return a ? haversineKm(a, b) : null;
}

/** Projiziert einen Punkt um distanceKm in Richtung bearingDeg (großkreis-näherung). */
function projectPoint(
  start: { lat: number; lon: number },
  bearingDeg: number,
  distanceKm: number,
): { lat: number; lon: number } {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const δ = distanceKm / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(start.lat);
  const λ1 = toRad(start.lon);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
  );
  return { lat: toDeg(φ2), lon: ((toDeg(λ2) + 540) % 360) - 180 };
}