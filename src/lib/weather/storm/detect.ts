import type { LightningStrike } from "@/lib/weather/sources/blitzortung";
import { distanceKm } from "./geo";

export interface RawCluster {
  strikes: LightningStrike[];
}

/**
 * DBSCAN auf Blitze. Liefert räumlich zusammenhängende Cluster.
 * Rauschen wird verworfen. Distanzmetrik: Haversine.
 */
export function dbscanStrikes(strikes: LightningStrike[], epsKm: number, minPts: number): RawCluster[] {
  const n = strikes.length;
  if (n === 0) return [];
  const visited = new Uint8Array(n);
  const cluster = new Int32Array(n).fill(-1);

  const neighbors = (idx: number): number[] => {
    const out: number[] = [];
    const a = strikes[idx];
    for (let j = 0; j < n; j++) {
      if (j === idx) continue;
      // Schneller Lat/Lon-Vorfilter spart Haversine-Aufrufe.
      if (Math.abs(strikes[j].lat - a.lat) > epsKm / 110) continue;
      if (distanceKm(a, strikes[j]) <= epsKm) out.push(j);
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
    const queue = nb.slice();
    while (queue.length > 0) {
      const j = queue.shift()!;
      if (!visited[j]) {
        visited[j] = 1;
        const nb2 = neighbors(j);
        if (nb2.length + 1 >= minPts) {
          for (const k of nb2) if (cluster[k] === -1 && !queue.includes(k)) queue.push(k);
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