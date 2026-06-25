import { describe, it, expect } from "vitest";
import { scoreCell, stormToLevel } from "./severity";
import { SEVERITY_RANK } from "./types";

const base = { strikeRatePerMin: 6, strikeRateTrend: 2, radiusKm: 4, strikeCount: 40 };

describe("scoreCell — Extrem-Gating", () => {
  it("ohne CAPE/LI niemals extreme", () => {
    const r = scoreCell({ ...base, env: {} });
    expect(r.level).not.toBe("extreme");
  });
  it("hohe Aktivität + CAPE≥2500/LI≤−8 am Zellort → extreme", () => {
    const r = scoreCell({ ...base, env: { cape: 3000, liftedIndex: -10, source: "cell" } });
    expect(r.level).toBe("extreme");
    expect(r.reasons.join(" ")).toMatch(/extrem/i);
  });
  it("Region-Proxy ist nie strenger als Zellort (höheres Gate)", () => {
    const env = { cape: 2500, liftedIndex: -4 };
    const cell = scoreCell({
      ...base,
      strikeRatePerMin: 4,
      strikeRateTrend: 1.5,
      strikeCount: 20,
      radiusKm: 5,
      env: { ...env, source: "cell" as const },
    }).level;
    const region = scoreCell({
      ...base,
      strikeRatePerMin: 4,
      strikeRateTrend: 1.5,
      strikeCount: 20,
      radiusKm: 5,
      env: { ...env, source: "region" as const },
    }).level;
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
