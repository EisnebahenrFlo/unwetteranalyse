/**
 * Hagel-Diagnose aus den offen verfügbaren Größen:
 *  - dBZ-Schätzung aus Blitzdichte (Reflektivitäts-Proxy ohne 3D-Radar)
 *  - Echo-Top-Höhe H45 aus CAPE-Updraft-Schätzung
 *  - Freezing Level H0 aus Open-Meteo (freezing_level_height)
 *  - POH (Probability of Hail) nach Waldvogel et al. 1979:
 *      POH = f(H45 - H0)  mit Übergang 1.6 km .. 5.5 km
 *  - MESHS (Maximum Expected Severe Hail Size) nach Witt 1998:
 *      vereinfachte Skalierung über CAPE + Δh + Reflektivitäts-Proxy
 *
 * Wichtig: ohne echtes 3D-Radar bleibt das eine fundierte Schätzung,
 * nicht das operationelle POH der Wetterdienste. Wir markieren das
 * in den Quellen explizit ("Proxy").
 */

import type { HailDiagnosis, HazardLevel, HazardSource } from "./types";

export interface HailInput {
  /** Strikes/min in der Zelle. */
  strikeRatePerMin: number;
  /** Strikes im Detection-Fenster. */
  strikeCount: number;
  /** Cluster-Radius (km). */
  radiusKm: number;
  /** CAPE am Zellort (J/kg). */
  cape: number | null;
  /** Lifted Index am Zellort (°C). */
  liftedIndex: number | null;
  /** Freezing Level Höhe (m AGL). */
  freezingLevelM: number | null;
  /** Lightning-Jump aktiv? Erhöht Hagelwahrscheinlichkeit deutlich. */
  jumpActive: boolean;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * dBZ-Proxy aus Blitzdichte. Wolken mit starker Elektrik und kompaktem Kern
 * korrelieren empirisch mit Reflektivität > 50 dBZ. Wir bilden 0..70 dBZ.
 */
function reflectivityProxy(input: HailInput): number {
  const rate = input.strikeRatePerMin;
  const density = input.radiusKm > 0 ? input.strikeCount / Math.max(1, input.radiusKm) : 0;
  // Basis 30 dBZ, +Rate, +Dichte. Cap 70 dBZ.
  return clamp(30 + rate * 4 + density * 1.5, 0, 70);
}

/**
 * Echo-Top H45 (m) aus CAPE-Updraft-Schätzung.
 * Updraft w ≈ sqrt(2·CAPE). Stoppt nahe der Tropopause.
 * Wir nähern die Höhe als Funktion von CAPE und LI an, gedeckelt bei 14 km.
 */
function echoTopMeters(input: HailInput): number | null {
  if (input.cape == null) return null;
  const cape = Math.max(0, input.cape);
  // Empirisch: 500 J/kg → ~7 km, 1500 J/kg → ~10 km, 2500 J/kg → ~12 km.
  const base = 5000 + Math.sqrt(cape) * 130;
  const liBoost = input.liftedIndex != null && input.liftedIndex < 0 ? -input.liftedIndex * 200 : 0;
  return clamp(base + liBoost, 3000, 14000);
}

/** POH nach Waldvogel: stetiger Anstieg zwischen Δh = 1.6 km und 5.5 km. */
function pohFromDeltaH(deltaKm: number): number {
  if (deltaKm <= 1.6) return 0;
  if (deltaKm >= 5.5) return 100;
  return Math.round(((deltaKm - 1.6) / (5.5 - 1.6)) * 100);
}

/**
 * MESHS-Schätzung. Witt 1998 nutzt vertikal integriertes Eisreflektivitätsfeld
 * (SHI). Wir simplifizieren: kombiniertes Maß aus dBZ-Proxy, Δh und CAPE,
 * skaliert auf typische Hagelgrößen 0..6 cm.
 */
function meshsCm(dbz: number, deltaKm: number, cape: number | null, jump: boolean): number {
  if (deltaKm < 1.6) return 0;
  const dbzPart = clamp((dbz - 45) / 25, 0, 1); // 45..70 dBZ
  const dhPart = clamp((deltaKm - 1.6) / 4, 0, 1);
  const capePart = cape != null ? clamp(cape / 2500, 0, 1) : 0.3;
  const jumpPart = jump ? 0.2 : 0;
  const raw = (dbzPart * 0.45 + dhPart * 0.35 + capePart * 0.2 + jumpPart) * 6;
  return Math.round(raw * 10) / 10;
}

function levelFor(poh: number, meshs: number): HazardLevel {
  if (meshs >= 4 || poh >= 90) return "extreme";
  if (meshs >= 2.5 || poh >= 75) return "high";
  if (meshs >= 1.2 || poh >= 50) return "elevated";
  if (poh >= 25) return "watch";
  return "none";
}

export function diagnoseHail(input: HailInput): HailDiagnosis {
  const reasons: string[] = [];
  const sources: HazardSource[] = [{ label: "Blitzortung (Reflektivitäts-Proxy)" }];

  const dbz = reflectivityProxy(input);
  const top = echoTopMeters(input);
  let deltaKm: number | null = null;

  if (top != null && input.freezingLevelM != null) {
    deltaKm = Math.max(0, (top - input.freezingLevelM) / 1000);
    sources.push({ label: "Open-Meteo CAPE/LI (Echo-Top-Schätzung)" });
    sources.push({ label: "Open-Meteo Freezing Level" });
    reasons.push(
      `Echo-Top ≈ ${Math.round(top / 100) / 10} km, H0 ${Math.round(input.freezingLevelM / 100) / 10} km → Δh ${deltaKm.toFixed(1)} km`,
    );
  } else {
    reasons.push("Echo-Top / Freezing Level fehlen — POH konservativ");
  }

  const poh = deltaKm != null ? pohFromDeltaH(deltaKm) : 0;
  const meshs = deltaKm != null ? meshsCm(dbz, deltaKm, input.cape, input.jumpActive) : 0;
  const level = levelFor(poh, meshs);

  reasons.unshift(
    `Reflektivitäts-Proxy ≈ ${Math.round(dbz)} dBZ aus ${input.strikeRatePerMin.toFixed(1)} Blitze/min`,
  );
  if (poh > 0) reasons.push(`POH ${poh} %`);
  if (meshs > 0) reasons.push(`MESHS ≈ ${meshs.toFixed(1)} cm`);
  if (input.jumpActive) reasons.push("Lightning Jump aktiv — Hagel wahrscheinlicher");

  const score = clamp(Math.round(poh * 0.6 + meshs * 8 + (input.jumpActive ? 10 : 0)), 0, 100);

  return {
    kind: "hail",
    level,
    score,
    reasons,
    sources,
    pohPercent: poh,
    meshsCm: meshs,
    deltaHkm: deltaKm,
  };
}
