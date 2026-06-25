/**
 * Z-R-Beziehung (Marshall-Palmer-Form) nach DWD-operationell Aniol:
 *   Z = a · R^b   mit   a = 256,  b = 1.42   (R in mm/h, Z in mm^6/m^3)
 *
 * Quelle: Aniol et al., DWD-operationelle Konvektionsbeziehung; siehe
 * wradlib-Dokumentation (zr_a=256, zr_b=1.42) und DWD-RADOLAN-Kurzbeschreibung.
 *
 * Hinweis: Diese Beziehung ist eine Schätzung — sie ist konvektiv kalibriert
 * und unterschätzt stratiformen sowie Hagel-Anteil. Für UI-Anzeigezwecke
 * (Schwellen, Severity) ausreichend, nicht für quantitative Niederschlags-
 * messung.
 */
const ZR_A = 256;
const ZR_B = 1.42;

/** Niederschlagsrate (mm/h) → äquivalente Radar-Reflektivität (dBZ). */
export function rainRateToDbz(rMmH: number): number {
  if (!Number.isFinite(rMmH) || rMmH <= 0) return 0;
  const z = ZR_A * Math.pow(rMmH, ZR_B);
  return 10 * Math.log10(z);
}

/** dBZ → Niederschlagsrate (mm/h). */
export function dbzToRainRate(dbz: number): number {
  if (!Number.isFinite(dbz)) return 0;
  const z = Math.pow(10, dbz / 10);
  return Math.pow(z / ZR_A, 1 / ZR_B);
}