import { describe, it, expect } from "vitest";
import { WIND_GUST_RULES, PRECIP_RULES, CAPE_RULES } from "./dwd";

const byId = (rules: typeof WIND_GUST_RULES, id: string) => rules.find((r) => r.id === id)!;

describe("DWD-Schwellen — Grenzen", () => {
  it("Wind (Bft-Mapping)", () => {
    expect(byId(WIND_GUST_RULES, "wind-minor").evaluate(13.9)).toBe(false);
    expect(byId(WIND_GUST_RULES, "wind-minor").evaluate(14)).toBe(true);
    expect(byId(WIND_GUST_RULES, "wind-minor").evaluate(20.8)).toBe(false);
    expect(byId(WIND_GUST_RULES, "wind-moderate").evaluate(20.8)).toBe(true);
    expect(byId(WIND_GUST_RULES, "wind-moderate").evaluate(28.4)).toBe(false);
    expect(byId(WIND_GUST_RULES, "wind-severe").evaluate(28.4)).toBe(true);
    expect(byId(WIND_GUST_RULES, "wind-severe").evaluate(38.9)).toBe(false);
    expect(byId(WIND_GUST_RULES, "wind-extreme").evaluate(38.9)).toBe(true);
  });
  it("Starkregen", () => {
    expect(byId(PRECIP_RULES, "rain-minor").evaluate(14.9)).toBe(false);
    expect(byId(PRECIP_RULES, "rain-minor").evaluate(15)).toBe(true);
    expect(byId(PRECIP_RULES, "rain-moderate").evaluate(25)).toBe(true);
    expect(byId(PRECIP_RULES, "rain-severe").evaluate(40)).toBe(true);
  });
  it("CAPE", () => {
    expect(byId(CAPE_RULES, "cape-minor").evaluate(499)).toBe(false);
    expect(byId(CAPE_RULES, "cape-minor").evaluate(500)).toBe(true);
    expect(byId(CAPE_RULES, "cape-severe").evaluate(2500)).toBe(true);
  });
});
