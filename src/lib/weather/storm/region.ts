/**
 * Geo-Filter für die Stormtracking-Detection.
 * Begrenzt Zellerkennung auf DACH (DE/AT/CH/LI) und Italien inkl. Inseln,
 * mit konfigurierbarem Puffer um Randzellen nicht abzuschneiden.
 */

export const DACH_IT_BBOX = {
  west: 5.5,
  south: 35.5,
  east: 18.7,
  north: 55.5,
} as const;

export const DACH_IT_BUFFER_KM = 50;

/** True, wenn Punkt innerhalb BBox + Puffer (in km) liegt. */
export function isInRegion(lat: number, lon: number, bufferKm = DACH_IT_BUFFER_KM): boolean {
  const latBuf = bufferKm / 111.32;
  const cos = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const lonBuf = bufferKm / (111.32 * cos);
  return (
    lat >= DACH_IT_BBOX.south - latBuf &&
    lat <= DACH_IT_BBOX.north + latBuf &&
    lon >= DACH_IT_BBOX.west - lonBuf &&
    lon <= DACH_IT_BBOX.east + lonBuf
  );
}

/**
 * Sehr grobe Länderzuordnung für Anzeigenamen.
 * Reicht für Pillen wie "Zelle DE-A1"; keine politische Grenzgenauigkeit.
 */
export function regionCountryPrefix(lat: number, lon: number): "DE" | "AT" | "CH" | "IT" | "EU" {
  // Italien: südlich ~47°N und westlich ~14.5°E reicht für Mainland + Sizilien/Sardinien.
  if (lat <= 47.1 && lon >= 6.6 && lon <= 18.6 && lat >= 35.5) {
    // Schweiz-Süd vs. Norditalien grob trennen.
    if (lat >= 45.8 && lon <= 10.5) return "CH";
    if (lat <= 47.0) return "IT";
  }
  // Schweiz BBox.
  if (lat >= 45.8 && lat <= 47.9 && lon >= 5.9 && lon <= 10.6) return "CH";
  // Österreich BBox.
  if (lat >= 46.3 && lat <= 49.1 && lon >= 9.5 && lon <= 17.2) return "AT";
  // Deutschland BBox.
  if (lat >= 47.2 && lat <= 55.1 && lon >= 5.8 && lon <= 15.1) return "DE";
  return "EU";
}
