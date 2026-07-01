import type { SoundingProfile } from "./profile";

/**
 * Konvektive Composite-Parameter.
 * SCP/STP als FIXED-LAYER-Näherung (Original SPC nutzt effektive Einflussschicht
 * ESRH/EBWD; ohne Parcel-Level hier bewusst Fixed-Layer mit 0–6 km Shear + 0–1/0–3 km SRH).
 * Werte sind US/SPC-kalibriert → in Mitteleuropa als Orientierung, nicht als Absolutschwelle.
 */
export interface Composites {
  ehi01: number | null;
  ehi03: number | null;
  scp: number | null;
  stp: number | null;
}

/** Energy-Helicity-Index = CAPE × SRH / 160000. */
function ehi(cape: number, srh: number): number {
  return (cape * srh) / 160_000;
}

/**
 * Supercell Composite Parameter (Fixed-Layer).
 * SCP = (CAPE/1000) × (SRH₀₋₃/50) × Shear-Term
 * Shear-Term: 0 bei <10 m/s, linear bis 1.0, gedeckelt bei 20 m/s.
 */
function scp(cape: number, srh03: number, shear06: number): number {
  const shr = shear06 < 10 ? 0 : Math.min(1, shear06 / 20);
  return (cape / 1000) * (srh03 / 50) * shr;
}

/**
 * Significant Tornado Parameter (Fixed-Layer).
 * STP = (CAPE/1500) × LCL-Term × (SRH₀₋₁/150) × Shear-Term
 * LCL-Term: 1 bei <1000 m, 0 bei >2000 m, linear dazwischen.
 * Shear-Term: 0 bei <12.5 m/s, sonst Shear/20 gedeckelt bei 1.5.
 */
function stp(cape: number, lclAgl: number, srh01: number, shear06: number): number {
  const lclT = lclAgl < 1000 ? 1 : lclAgl > 2000 ? 0 : (2000 - lclAgl) / 1000;
  const shrT = shear06 < 12.5 ? 0 : Math.min(1.5, shear06 / 20);
  return (cape / 1500) * lclT * (srh01 / 150) * shrT;
}

export function computeComposites(p: SoundingProfile): Composites {
  const k = p.kinematics;
  if (!k || p.cape == null) return { ehi01: null, ehi03: null, scp: null, stp: null };
  const cape = p.cape;
  return {
    ehi01: ehi(cape, k.srh01),
    ehi03: ehi(cape, k.srh03),
    scp: scp(cape, k.srh03, k.shear06Ms),
    stp: p.lclHeightAglM != null ? stp(cape, p.lclHeightAglM, k.srh01, k.shear06Ms) : null,
  };
}

/** Grobe Einordnung für Farbakzent (neutral, KEINE Warnstufen-Semantik). */
export type CompositeLevel = "neutral" | "erhoeht" | "hoch";
export function scpLevel(v: number | null): CompositeLevel {
  if (v == null) return "neutral";
  if (v >= 4) return "hoch";
  if (v >= 1) return "erhoeht";
  return "neutral";
}
export function stpLevel(v: number | null): CompositeLevel {
  if (v == null) return "neutral";
  if (v >= 1) return "hoch";
  if (v >= 0.5) return "erhoeht";
  return "neutral";
}