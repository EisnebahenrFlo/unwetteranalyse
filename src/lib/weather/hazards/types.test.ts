import { describe, it, expect } from "vitest";
import { hazardToLevel } from "./types";

describe("hazardToLevel", () => {
  it("mappt HazardLevel auf DisplayLevel 0–4", () => {
    expect(hazardToLevel("none")).toBe(0);
    expect(hazardToLevel("watch")).toBe(1);
    expect(hazardToLevel("elevated")).toBe(2);
    expect(hazardToLevel("high")).toBe(3);
    expect(hazardToLevel("extreme")).toBe(4);
  });
});
