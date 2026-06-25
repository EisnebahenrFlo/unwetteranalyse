/**
 * Diagnose-Schicht für das Radar-Cockpit (ohne Blitz).
 * Alle Funktionen sind reine Mappings. Daten fließen aus dem Radar-
 * Snapshot und dem Open-Meteo-Forecast ein.
 */
import type { WmsTimeline } from "@/lib/weather/sources/dwd-wms";
import type { HourlyPoint } from "@/lib/weather/types";

export type Verdict = "ok" | "watch" | "alert" | "unknown";

export interface TriggerLight {
  moisture: Verdict;
  instability: Verdict;
  lift: Verdict;
  precipSignal: Verdict;
  liveConfirm: Verdict;
  summary: string;
  score: number;
}

/**
 * Auslöser-Ampel: 5 Achsen.
 */
export function triggerLight(input: {
  nowHour?: HourlyPoint;
  radarTopDbz: number | null;
  ryLagMs: number | null;
}): TriggerLight {
  const h = input.nowHour;

  const spread =
    h?.temperatureC != null && h?.dewPointC != null ? h.temperatureC - h.dewPointC : null;
  const moisture: Verdict =
    spread == null ? "unknown" : spread <= 3 ? "alert" : spread <= 6 ? "watch" : "ok";

  const cape = h?.cape ?? null;
  const li = h?.liftedIndex ?? null;
  const instability: Verdict =
    cape == null && li == null
      ? "unknown"
      : (cape != null && cape >= 1500) || (li != null && li <= -4)
        ? "alert"
        : (cape != null && cape >= 500) || (li != null && li <= -2)
          ? "watch"
          : "ok";

  const gust = h?.windGustMs ?? null;
  const bl = h?.boundaryLayerHeightM ?? null;
  const lift: Verdict =
    gust == null && bl == null
      ? "unknown"
      : (gust != null && gust >= 18) || (bl != null && bl >= 2500)
        ? "alert"
        : (gust != null && gust >= 12) || (bl != null && bl >= 1500)
          ? "watch"
          : "ok";

  const prec = h?.precipitationMm ?? null;
  const pp = h?.precipitationProbability ?? null;
  const precipSignal: Verdict =
    prec == null && pp == null
      ? "unknown"
      : (prec != null && prec >= 2) || (pp != null && pp >= 70)
        ? "alert"
        : (prec != null && prec >= 0.3) || (pp != null && pp >= 40)
          ? "watch"
          : "ok";

  const radarFresh = input.ryLagMs != null && input.ryLagMs <= 15 * 60_000;
  const top = input.radarTopDbz ?? 0;
  const liveConfirm: Verdict =
    !radarFresh && top === 0
      ? "unknown"
      : top >= 50
        ? "alert"
        : top >= 40 || (radarFresh && (prec ?? 0) >= 0.3)
          ? "watch"
          : "ok";

  const axes = [moisture, instability, lift, precipSignal, liveConfirm];
  const score = axes.filter((v) => v === "alert").length;
  const watches = axes.filter((v) => v === "watch").length;

  let summary = "Lage ruhig.";
  if (score >= 3) summary = "Mehrere Auslöser gleichzeitig aktiv.";
  else if (score >= 1) summary = "Einzelne Auslöser aktiv, beobachten.";
  else if (watches >= 2) summary = "Vorzeichen erkennbar, noch keine Auslösung.";

  return { moisture, instability, lift, precipSignal, liveConfirm, summary, score };
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
  radarTopDbz: number | null;
  ryFreshAndWet: boolean;
}): ModelObsCheck {
  const cape = input.nowHour?.cape ?? null;
  const li = input.nowHour?.liftedIndex ?? null;
  const pp = input.nowHour?.precipitationProbability ?? null;
  const modelExpectsConvection =
    (cape != null && cape >= 500) || (li != null && li <= -2) || (pp != null && pp >= 60);
  const observedConvection = (input.radarTopDbz ?? 0) >= 40 || input.ryFreshAndWet;

  let state: ModelObsState;
  if (cape == null && pp == null && (input.radarTopDbz ?? 0) === 0 && !input.ryFreshAndWet)
    state = "unknown";
  else if (modelExpectsConvection && observedConvection) state = "match";
  else if (modelExpectsConvection && !observedConvection) state = "model_overcalls";
  else if (!modelExpectsConvection && observedConvection) state = "model_underestimates";
  else state = "match";

  const detail = (() => {
    switch (state) {
      case "match":
        return "Modell und Radar erzählen die gleiche Geschichte.";
      case "model_overcalls":
        return "Modell sieht konvektives Potenzial, das Radar bestätigt es nicht. Vorsichtig bewerten.";
      case "model_underestimates":
        return "Radar zeigt Aktivität, die das Modell so nicht im Bild hat.";
      default:
        return "Nicht genug Datenbasis für Vergleich.";
    }
  })();

  return { state, detail, modelExpectsConvection, observedConvection };
}

/* -------------------- Snapshot-Status -------------------- */

export interface SnapshotHealth {
  label: string;
  status: "ok" | "limited" | "missing";
  detail: string;
}

export function assessSnapshot(input: {
  snapshotStatus: "idle" | "loading" | "ok" | "error";
  cellCount: number;
  lastFrameTime: string | null;
  lastRun: number;
}): SnapshotHealth {
  if (input.snapshotStatus === "ok") {
    const lagMs = input.lastFrameTime ? Date.now() - new Date(input.lastFrameTime).getTime() : 0;
    const lagMin = Math.round(lagMs / 60_000);
    return {
      label: "Stormtrack",
      status: lagMin <= 10 ? "ok" : "limited",
      detail: `${input.cellCount} Zelle${input.cellCount === 1 ? "" : "n"} · Frame ${lagMin} min alt`,
    };
  }
  if (input.snapshotStatus === "loading")
    return { label: "Stormtrack", status: "limited", detail: "lädt Radar-Snapshot…" };
  if (input.snapshotStatus === "error")
    return { label: "Stormtrack", status: "missing", detail: "Radar-Fetch fehlgeschlagen" };
  return { label: "Stormtrack", status: "missing", detail: "inaktiv" };
}