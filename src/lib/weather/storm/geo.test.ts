import { describe, it, expect } from "vitest";
import { distanceKm } from "./geo";

describe("distanceKm (Haversine)", () => {
  it("1° Breitengrad ≈ 111,2 km", () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.19, 0);
  });
  it("identische Punkte = 0", () => {
    expect(distanceKm({ lat: 49, lon: 10 }, { lat: 49, lon: 10 })).toBe(0);
  });
});
