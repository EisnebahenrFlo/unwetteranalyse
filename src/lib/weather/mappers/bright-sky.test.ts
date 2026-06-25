import { describe, it, expect } from "vitest";
import { mapBrightSkyAlerts } from "./bright-sky";

describe("mapBrightSkyAlerts", () => {
  it("liest CAP-severity-String und setzt warnLevel korrekt", () => {
    const [a] = mapBrightSkyAlerts({
      alerts: [
        {
          alert_id: "x1",
          severity: "severe",
          event_de: "GEWITTER",
          headline_de: "Amtliche UNWETTERWARNUNG",
          description_de: "d",
          onset: "2026-06-25T10:00:00+00:00",
          expires: "2026-06-25T14:00:00+00:00",
        },
      ],
    });
    expect(a.severity).toBe("severe");
    expect(a.warnLevel).toBe(3);
    expect(a.headline).toBe("Amtliche UNWETTERWARNUNG");
  });

  it("fällt bei fehlender severity auf Stufe 1 zurück", () => {
    const [a] = mapBrightSkyAlerts({ alerts: [{ alert_id: "x2" }] });
    expect(a.severity).toBe("minor");
    expect(a.warnLevel).toBe(1);
  });

  it("leere Eingabe → leeres Array", () => {
    expect(mapBrightSkyAlerts({})).toEqual([]);
  });
});
