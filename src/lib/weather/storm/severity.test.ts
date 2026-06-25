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

describe("scoreCell — Wind-Kriterium (DWD-Maximum)", () => {
  const weak = {
    topDbz: 38,
    hailCoreAreaKm2: 0,
    areaKm2: 20,
    dbzTrend: 0,
    areaTrend: 1,
  };
  it("Böen ≥25 m/s hebt schwache Zelle auf mindestens 'severe'", () => {
    const r = scoreCell({ ...weak, env: { windGustMs: 26, source: "cell" } });
    expect(SEVERITY_RANK[r.level]).toBeGreaterThanOrEqual(SEVERITY_RANK.severe);
    expect(r.reasons.join(" ")).toMatch(/B[öo]en/);
  });
  it("Böen ≥18 m/s → mindestens 'serious'", () => {
    const r = scoreCell({ ...weak, env: { windGustMs: 20, source: "cell" } });
    expect(SEVERITY_RANK[r.level]).toBeGreaterThanOrEqual(SEVERITY_RANK.serious);
  });
  it("Orkanböen ohne CAPE/LI-Stütze bleiben bei 'severe' (Gate aktiv)", () => {
    const r = scoreCell({ ...weak, env: { windGustMs: 35, source: "cell" } });
    expect(r.level).toBe("severe");
  });
  it("kein Wind → keine Stufenanhebung", () => {
    const r = scoreCell({ ...weak, env: {} });
    expect(SEVERITY_RANK[r.level]).toBeLessThan(SEVERITY_RANK.serious);
  });
});

describe("scoreCell — Extreme-Gate verschärft (kein Hagel-Alleingang)", () => {
  const hot = {
    topDbz: 60,
    hailCoreAreaKm2: 6,
    areaKm2: 220,
    dbzTrend: 5,
    areaTrend: 1.6,
  };
  it("großer Hagelkern OHNE CAPE/LI/Wind-Stütze → max 'severe'", () => {
    const r = scoreCell({ ...hot, env: { source: "cell" } });
    expect(r.level).toBe("severe");
  });
  it("hoher Score MIT CAPE≥2500 → 'extreme'", () => {
    const r = scoreCell({ ...hot, env: { cape: 2800, source: "cell" } });
    expect(r.level).toBe("extreme");
  });
  it("hoher Score MIT Orkanböen (≥33 m/s) → 'extreme'", () => {
    const r = scoreCell({ ...hot, env: { windGustMs: 34, source: "cell" } });
    expect(r.level).toBe("extreme");
    expect(r.reasons.join(" ")).toMatch(/Orkanb[öo]en/);
  });
});
  it("kein Wind → keine Stufenanhebung", () => {
    const r = scoreCell({ ...weak, env: {} });
    expect(SEVERITY_RANK[r.level]).toBeLessThan(SEVERITY_RANK.serious);
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