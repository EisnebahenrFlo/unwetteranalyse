import { describe, expect, it } from "vitest";
import { analyzeEnsemble, collectMembers } from "./ensemble";

describe("collectMembers", () => {
  it("sammelt Basisfeld vor Member-Spalten in stabiler Reihenfolge", () => {
    const hourly = {
      time: ["2024-01-01T00:00"],
      cape: [100],
      cape_member02: [300],
      cape_member01: [200],
      precipitation: [1],
    };
    const got = collectMembers(hourly as unknown as Record<string, unknown>, "cape");
    expect(got.map((a) => a[0])).toEqual([100, 200, 300]);
  });
});

describe("analyzeEnsemble", () => {
  it("berechnet Wahrscheinlichkeiten aus Member-Anteilen", () => {
    const t = "2999-01-01T12:00";
    const raw = {
      hourly: {
        time: [t],
        cape: [600],
        cape_member01: [800],
        cape_member02: [200], // unter 500
        cape_member03: [1600], // strong
        precipitation: [20],
        precipitation_member01: [5],
        precipitation_member02: [16],
        precipitation_member03: [2],
        wind_gusts_10m: [10],
        wind_gusts_10m_member01: [26],
        wind_gusts_10m_member02: [8],
        wind_gusts_10m_member03: [30],
      },
    };
    const now = new Date("2999-01-01T11:00Z");
    const { timeline, summary } = analyzeEnsemble(raw, now);
    expect(timeline.length).toBe(1);
    const p0 = timeline[0];
    // 3 von 4 Member ≥ 500
    expect(p0.pThunder).toBeCloseTo(0.75, 2);
    expect(p0.pStrong).toBeCloseTo(0.25, 2);
    expect(p0.pHeavyRain).toBeCloseTo(0.5, 2);
    // 2 von 4 Member mit Böen ≥ 25 m/s (26, 30)
    expect(p0.pStorm).toBeCloseTo(0.5, 2);
    expect(p0.members).toBe(4);
    expect(summary.memberCount).toBe(4);
    expect(summary.headline).toMatch(/Hohe Gewitterwahrscheinlichkeit/);
  });

  it("liefert leere Timeline bei fehlendem hourly", () => {
    const { timeline, summary } = analyzeEnsemble({}, new Date());
    expect(timeline).toEqual([]);
    expect(summary.memberCount).toBe(0);
    expect(summary.headline).toMatch(/Gering/);
  });
});