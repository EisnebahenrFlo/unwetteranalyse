import { describe, expect, it } from "vitest";
import { buildGrid, type TempField } from "./temperature-field";
import { sampleField } from "./field-render";

describe("temperature field grid", () => {
  it("hat 27 Breiten- und 18 Längen-Stützstellen (486 Punkte)", () => {
    const { lats, lons } = buildGrid();
    expect(lats.length).toBe(27);
    expect(lons.length).toBe(18);
    expect(lats.length * lons.length).toBe(486);
  });
});

describe("sampleField bilinear", () => {
  const field: TempField = {
    lats: [40, 41],
    lons: [10, 11],
    nLat: 2,
    nLon: 2,
    times: ["t"],
    temps: Float32Array.from([0, 10, 20, 30]),
    fetchedAt: 0,
  };
  it("trifft die Eckpunkte exakt", () => {
    expect(sampleField(field, 0, 40, 10)).toBeCloseTo(0);
    expect(sampleField(field, 0, 40, 11)).toBeCloseTo(10);
    expect(sampleField(field, 0, 41, 10)).toBeCloseTo(20);
    expect(sampleField(field, 0, 41, 11)).toBeCloseTo(30);
  });
  it("interpoliert Mitte und Kanten korrekt", () => {
    expect(sampleField(field, 0, 40.5, 10.5)).toBeCloseTo(15);
    expect(sampleField(field, 0, 40, 10.5)).toBeCloseTo(5);
    expect(sampleField(field, 0, 40.5, 10)).toBeCloseTo(10);
  });
});