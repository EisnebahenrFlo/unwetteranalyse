/**
 * Hagel-Diagnose aus Radar-Näherung plus Umgebungs-Stütze.
 *
 *  - topDbz: AUS NIEDERSCHLAGSRATE ABGELEITETE äquivalente Reflektivität
 *    (DWD-RY → Z-R Aniol, a=256, b=1.42). KEINE gemessene 3D-Reflektivität.
 *  - hailCoreAreaKm2: Fläche der Pixel ab Intensitätsstufe 5 (≈ 50 mm/h,
 *    abgeleitet ≈ 48 dBZ). Kernindikator für intensiven Konvektionskern.
 *  - Echo-Top H45 aus CAPE-Updraft-Schätzung
 *  - Freezing Level H0 aus Open-Meteo
 *  - POH (Probability of Hail) nach Waldvogel et al. 1979
 *  - MESHS-Schätzung kombiniert dBZ, Δh und CAPE
 *
 * Realismus-Check: Ohne echtes 3D-Reflektivitätsprodukt (DX) oder
 * RADOLAN-Binär ist Hagel hier eine Schätzung aus Niederschlagsrate +
 * CAPE/Freezing Level. POH/MESHS sind fundiert, aber nicht messscharf.
 */

import type { HailDiagnosis, HazardLevel, HazardSource } from "./types";

export interface HailInput {
  /** Aus RY-Rate abgeleitete äquivalente Top-Reflektivität (dBZ, Z-R Aniol). */
  topDbz: number;
  /** Hagelkern-Fläche (Stufe ≥5, ≈ 50 mm/h ≈ 48 dBZ abgeleitet) in km². */
  hailCoreAreaKm2: number;
  /** Gesamtfläche der Zelle in km². */
  areaKm2: number;
  /** CAPE am Zellort (J/kg). */
  cape: number | null;
  /** Lifted Index am Zellort (°C). */
  liftedIndex: number | null;
  /** Freezing Level Höhe (m AGL). */
  freezingLevelM: number | null;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function echoTopMeters(cape: number | null, li: number | null): number | null {
  if (cape == null) return null;
  const c = Math.max(0, cape);
  const base = 5000 + Math.sqrt(c) * 130;
  const liBoost = li != null && li < 0 ? -li * 200 : 0;
  return clamp(base + liBoost, 3000, 14000);
}

function pohFromDeltaH(deltaKm: number): number {
  if (deltaKm <= 1.6) return 0;
  if (deltaKm >= 5.5) return 100;
  return Math.round(((deltaKm - 1.6) / (5.5 - 1.6)) * 100);
}

function meshsCm(dbz: number, deltaKm: number, cape: number | null, coreKm2: number): number {
  if (deltaKm < 1.6 && coreKm2 < 1) return 0;
  const dbzPart = clamp((dbz - 45) / 20, 0, 1); // 45..65 dBZ
  const dhPart = clamp((deltaKm - 1.6) / 4, 0, 1);
  const capePart = cape != null ? clamp(cape / 2500, 0, 1) : 0.3;
  const corePart = clamp(coreKm2 / 8, 0, 1);
  const raw = (dbzPart * 0.4 + dhPart * 0.25 + capePart * 0.15 + corePart * 0.2) * 6;
  return Math.round(raw * 10) / 10;
}

function levelFor(poh: number, meshs: number, coreKm2: number): HazardLevel {
  if (meshs >= 4 || poh >= 90 || coreKm2 >= 8) return "extreme";
  if (meshs >= 2.5 || poh >= 75 || coreKm2 >= 3) return "high";
  if (meshs >= 1.2 || poh >= 50 || coreKm2 >= 1) return "elevated";
  if (poh >= 25) return "watch";
  return "none";
}

export function diagnoseHail(input: HailInput): HailDiagnosis {
  const reasons: string[] = [];
  const sources: HazardSource[] = [{ label: "DWD-RY (Niederschlagsrate → dBZ via Z-R Aniol)" }];

  const top = echoTopMeters(input.cape, input.liftedIndex);
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
  const meshs = meshsCm(input.topDbz, deltaKm ?? 0, input.cape, input.hailCoreAreaKm2);
  const level = levelFor(poh, meshs, input.hailCoreAreaKm2);

  reasons.unshift(`Top ${Math.round(input.topDbz)} dBZ · Fläche ${Math.round(input.areaKm2)} km²`);
  if (input.hailCoreAreaKm2 >= 1)
    reasons.push(`Hagelkern ${input.hailCoreAreaKm2.toFixed(0)} km² (Stufe ≥5, ≈ 48 dBZ abgeleitet)`);
  if (poh > 0) reasons.push(`POH ${poh} %`);
  if (meshs > 0) reasons.push(`MESHS ≈ ${meshs.toFixed(1)} cm`);

  const score = clamp(
    Math.round(poh * 0.5 + meshs * 8 + input.hailCoreAreaKm2 * 3 + Math.max(0, input.topDbz - 45)),
    0,
    100,
  );

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