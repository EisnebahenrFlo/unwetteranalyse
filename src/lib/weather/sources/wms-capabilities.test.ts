import { describe, it, expect } from "vitest";
import { parseWmsTimeDimension } from "./wms-capabilities";

const xml = `<WMS_Capabilities><Capability><Layer>
  <Layer><Name>OhneZeit</Name></Layer>
  <Layer><Name>RADOLAN-RY</Name>
    <Dimension name="time" units="ISO8601">2026-06-25T10:00:00Z/2026-06-25T10:30:00Z/PT5M</Dimension>
  </Layer>
</Layer></Capability></WMS_Capabilities>`;

describe("parseWmsTimeDimension", () => {
  it("findet die time-Dimension am richtigen Layer", () => {
    expect(parseWmsTimeDimension(xml, "RADOLAN-RY"))
      .toBe("2026-06-25T10:00:00Z/2026-06-25T10:30:00Z/PT5M");
  });
  it("greift NICHT die Zeit eines fremden Layers (kein Cross-Leak)", () => {
    expect(parseWmsTimeDimension(xml, "OhneZeit")).toBeNull();
  });
  it("unbekannter Layer → null", () => {
    expect(parseWmsTimeDimension(xml, "Gibtsnicht")).toBeNull();
  });
});