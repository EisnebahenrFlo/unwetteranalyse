import { describe, expect, it } from "vitest";
import { hailRisk, thunderProbability } from "./convection";
import type { HourlyPoint } from "../types";

function hp(extra: Partial<HourlyPoint>): HourlyPoint {
  return {
    time: "2024-06-01T12:00:00Z",
    temperatureC: 25,
    ...extra,
  };
}

describe("hailRisk", () => {
  it("nimmt Modellsignal: WMO 99 → severe", () => {
    expect(hailRisk(hp({ weatherCode: 99 }))).toBe("severe");
  });
  it("nimmt Modellsignal: WMO 96 → moderate", () => {
    expect(hailRisk(hp({ weatherCode: 96 }))).toBe("moderate");
  });
  it("ohne LI: CAPE 2600 + Freezing Level 3000 m → moderate", () => {
    expect(hailRisk(hp({ cape: 2600, freezingLevelM: 3000 }))).toBe("moderate");
  });
  it("zu wenig CAPE → none", () => {
    expect(hailRisk(hp({ cape: 400 }))).toBe("none");
  });
});

describe("thunderProbability CIN-Dämpfung", () => {
  it("CAPE 2000 ohne CIN bleibt 0.8", () => {
    expect(thunderProbability(hp({ cape: 2000, convectiveInhibition: 0 }))).toBeCloseTo(0.8, 5);
  });
  it("CAPE 2000 mit CIN 300 wird halbiert auf 0.4", () => {
    expect(thunderProbability(hp({ cape: 2000, convectiveInhibition: 300 }))).toBeCloseTo(0.4, 5);
  });
});