/** Erdradius in km. */
const R = 6371;

export function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

/** Haversine-Distanz in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initialbearing a → b in Grad (0 = N, 90 = E). */
export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const λ1 = toRad(a.lon);
  const λ2 = toRad(b.lon);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function bearingCompass(deg: number) {
  const dirs = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

/** Bewegt einen Punkt um distance km in Richtung bearing. */
export function destination(a: { lat: number; lon: number }, distanceKm: number, bearingDegVal: number) {
  const δ = distanceKm / R;
  const θ = toRad(bearingDegVal);
  const φ1 = toRad(a.lat);
  const λ1 = toRad(a.lon);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lon: ((toDeg(λ2) + 540) % 360) - 180 };
}

/**
 * Andrew's Monotone Chain Convex Hull, arbeitet auf [lon, lat].
 * Für unsere kleinen Cluster-Größen ist die ebene Approximation ok.
 */
export function convexHull(points: { lat: number; lon: number }[]): [number, number][] {
  if (points.length === 0) return [];
  if (points.length === 1) return [[points[0].lon, points[0].lat]];
  const pts = points
    .map((p) => [p.lon, p.lat] as [number, number])
    .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

export function centroidOf(points: { lat: number; lon: number }[]) {
  let lat = 0;
  let lon = 0;
  for (const p of points) {
    lat += p.lat;
    lon += p.lon;
  }
  return { lat: lat / points.length, lon: lon / points.length };
}

/** Maximale Distanz von Centroid zu Cluster-Punkten in km. */
export function radiusKm(centroid: { lat: number; lon: number }, points: { lat: number; lon: number }[]) {
  let max = 0;
  for (const p of points) {
    const d = distanceKm(centroid, p);
    if (d > max) max = d;
  }
  return max;
}