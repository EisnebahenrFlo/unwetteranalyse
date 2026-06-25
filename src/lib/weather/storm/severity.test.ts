import { describe, it, expect } from "vitest";
import { scoreCell, stormToLevel } from "./severity";
import { SEVERITY_RANK } from "./types";

const base = {
  topDbz: 52,
  hailCoreAreaKm2: 0,
  areaKm2: 80,
  dbzTrend: 4,
  areaTrend: 1.4,
};

describe("scoreCell — Extrem-Gating", () => {
  it("ohne CAPE/LI/Hagelkern niemals extreme", () => {
    const r = scoreCell({ ...base, env: {} });
    expect(r.level).not.toBe("extreme");
  });
  it("hohe Aktivität + CAPE≥2500/LI≤−8 am Zellort → extreme", () => {
    const r = scoreCell({
      ...base,
      topDbz: 58,
      areaKm2: 180,
      env: { cape: 3000, liftedIndex: -10, source: "cell" },
    });
    expect(r.level).toBe("extreme");
    expect(r.reasons.join(" ")).toMatch(/Stufe 4/i);
  });
  it("Region-Proxy ist nie strenger als Zellort (höheres Gate)", () => {
    const env = { cape: 2500, liftedIndex: -4 };
    const cell = scoreCell({ ...base, env: { ...env, source: "cell" as const } }).level;
    const region = scoreCell({ ...base, env: { ...env, source: "region" as const } }).level;
    expect(SEVERITY_RANK[cell]).toBeGreaterThanOrEqual(SEVERITY_RANK[region]);
  });
});

describe("stormToLevel", () => {
  it("mappt auf DisplayLevel 0–4", () => {
    expect(stormToLevel("calm")).toBe(0);
    expect(stormToLevel("watch")).toBe(1);
    expect(stormToLevel("serious")).toBe(2);
    expect(stormToLevel("severe")).toBe(3);
    expect(stormToLevel("extreme")).toBe(4);
  });
});