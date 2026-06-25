import { describe, it, expect } from "vitest";
import { dbscanStrikes } from "./detect";

const s = (lat: number, lon: number) => ({ time: 0, lat, lon });

describe("dbscanStrikes", () => {
  it("trennt zwei räumlich getrennte Cluster und verwirft Rauschen", () => {
    const cluster1 = [s(49.0, 10.0), s(49.01, 10.0), s(49.0, 10.01), s(49.01, 10.01)];
    const cluster2 = [s(50.0, 11.0), s(50.01, 11.0), s(50.0, 11.01), s(50.01, 11.01)];
    const noise = [s(45.0, 5.0)];
    const out = dbscanStrikes([...cluster1, ...cluster2, ...noise], 10, 3);
    expect(out).toHaveLength(2);
    const total = out.reduce((n, c) => n + c.strikes.length, 0);
    expect(total).toBe(8);
  });
  it("leere Eingabe → leeres Array", () => {
    expect(dbscanStrikes([], 10, 3)).toEqual([]);
  });
});