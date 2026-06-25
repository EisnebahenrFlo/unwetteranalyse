import type { LightningStrike } from "@/lib/weather/sources/blitzortung";
import { distanceKm, toRad } from "./geo";

export interface RawCluster {
  strikes: LightningStrike[];
}

/**
 * DBSCAN auf Blitze. Liefert räumlich zusammenhängende Cluster.
 * Rauschen wird verworfen. Distanzmetrik: Haversine.
 *
 * Nachbarsuche über ein gleichmäßiges Gitter (~eps große Zellen): statt jeden
 * Blitz gegen jeden zu prüfen (O(n²)) werden nur die 3×3 umliegenden Zellen
 * gescannt → im Mittel ~O(n). Die exakte ≤eps-Prüfung bleibt Haversine,
 * das Ergebnis ist identisch zur Brute-Force-Variante.
 */
export function dbscanStrikes(strikes: LightningStrike[], epsKm: number, minPts: number): RawCluster[] {
  const n = strikes.length;
  if (n === 0) return [];

  // Zellgröße in Grad so wählen, dass eine Zelle überall ≥ epsKm misst →
  // alle echten Nachbarn liegen garantiert in den 3×3-Nachbarzellen.
  let maxAbsLat = 0;
  for (let i = 0; i < n; i++) {
    const al = Math.abs(strikes[i].lat);
    if (al > maxAbsLat) maxAbsLat = al;
  }
  const cosLat = Math.max(0.05, Math.cos(toRad(maxAbsLat)));
  const latStep = epsKm / 110.574;
  const lonStep = epsKm / (111.320 * cosLat);

  const gx = (lon: number) => Math.floor(lon / lonStep);
  const gy = (lat: number) => Math.floor(lat / latStep);
  const key = (ix: number, iy: number) => `${ix}:${iy}`;

  const grid = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const k = key(gx(strikes[i].lon), gy(strikes[i].lat));
    const bucket = grid.get(k);
    if (bucket) bucket.push(i);
    else grid.set(k, [i]);
  }

  const visited = new Uint8Array(n);
  const queued = new Uint8Array(n);
  const cluster = new Int32Array(n).fill(-1);

  const neighbors = (idx: number): number[] => {
    const a = strikes[idx];
    const cx = gx(a.lon);
    const cy = gy(a.lat);
    const out: number[] = [];
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      for (let iy = cy - 1; iy <= cy + 1; iy++) {
        const bucket = grid.get(key(ix, iy));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j === idx) continue;
          if (distanceKm(a, strikes[j]) <= epsKm) out.push(j);
        }
      }
    }
    return out;
  };

  let cId = 0;
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = 1;
    const nb = neighbors(i);
    if (nb.length + 1 < minPts) continue;
    const id = cId++;
    cluster[i] = id;
    const queue: number[] = [];
    for (const j of nb) { queue.push(j); queued[j] = 1; }
    let head = 0;
    while (head < queue.length) {
      const j = queue[head++];
      if (!visited[j]) {
        visited[j] = 1;
        const nb2 = neighbors(j);
        if (nb2.length + 1 >= minPts) {
          for (const k of nb2) if (!queued[k]) { queued[k] = 1; queue.push(k); }
        }
      }
      if (cluster[j] === -1) cluster[j] = id;
    }
  }

  const buckets = new Map<number, LightningStrike[]>();
  for (let i = 0; i < n; i++) {
    if (cluster[i] === -1) continue;
    const arr = buckets.get(cluster[i]) ?? [];
    arr.push(strikes[i]);
    buckets.set(cluster[i], arr);
  }
  return [...buckets.values()].map((s) => ({ strikes: s }));
}