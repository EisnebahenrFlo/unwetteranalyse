import { describe, it, expect } from "vitest";
import { capSeverityToLevel, capSeverityToAlert, severityToLevel } from "./warn-level";

describe("warn-level mapping", () => {
  it("CAP-String → DWD-Stufe", () => {
    expect(capSeverityToLevel("minor")).toBe(1);
    expect(capSeverityToLevel("moderate")).toBe(2);
    expect(capSeverityToLevel("severe")).toBe(3);
    expect(capSeverityToLevel("extreme")).toBe(4);
    expect(capSeverityToLevel(undefined)).toBe(1);
    expect(capSeverityToLevel("SEVERE")).toBe(3);
  });
  it("CAP-String → AlertSeverity", () => {
    expect(capSeverityToAlert("extreme")).toBe("extreme");
    expect(capSeverityToAlert("quatsch")).toBe("minor");
  });
  it("AlertSeverity → Stufe", () => {
    expect(severityToLevel("minor")).toBe(1);
    expect(severityToLevel("extreme")).toBe(4);
  });
});