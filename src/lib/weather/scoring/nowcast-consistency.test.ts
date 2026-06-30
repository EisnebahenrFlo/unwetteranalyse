import { describe, it, expect } from "vitest";
import { buildNowcast } from "./nowcast";
import { buildNowcast2h } from "../analysis/nowcast";
import { thunderSubscore, dataConfidence, type DataContextInput } from "./subscores";
import type { HourlyPoint } from "../types";

// combine() ist nicht exportiert — wir prüfen sein Verhalten via buildNowcast,
// indem wir die Subscores über kontrollierte Inputs steuern.

function makeHourly(over: Partial<HourlyPoint> = {}): HourlyPoint[] {
  const base: HourlyPoint = {
    time: new Date().toISOString(),
    temperatureC: 20,
    precipitationMm: 0,
    precipitationProbability: 0,
    windSpeedMs: 0,
    windGustMs: 0,
    ...over,
  };
  // 4 Stunden Stützstellen
  return Array.from({ length: 4 }, (_, i) => ({
    ...base,
    time: new Date(Date.now() + i * 3600_000).toISOString(),
  }));
}

const baseCtx: DataContextInput = {
  hasMinutely: false,
  hasUpperLevels: false,
  hasConvective: false,
  liveObsAgeMinutes: null,
  radarAgeMinutes: null,
  modelObsConsistent: null,
};

describe("combine — Multi-Source-Gate (via buildNowcast)", () => {
  it("einzelne starke Achse (Thunder) ohne Bestätigung wird auf 59 gedeckelt", () => {
    // Sehr starkes Gewittersignal allein: Code 95 + Radar mit Niederschlag -> hoher thunder,
    // andere Achsen niedrig (Regen leicht, Wind 0, Konvektion 0).
    const hourly = makeHourly({
      weatherCode: 95,
      precipitationMm: 0.6, // Radar wird gezählt, aber Regen-Subscore bleibt unter 45
      windGustMs: 0,
      cape: 0,
      liftedIndex: 5,
    });
    const r = buildNowcast({
      hourly,
      now: new Date(),
      radarTopDbz: 60,
    });
    expect(r.subs.thunder.value).toBeGreaterThanOrEqual(60);
    expect(r.subs.rain.value).toBeLessThan(45);
    expect(r.subs.wind.value).toBeLessThan(45);
    expect(r.subs.convection.value).toBeLessThan(45);
    expect(r.total).toBeLessThan(60);
  });

  it("zwei korrelierende Achsen >=45 dürfen >=60 erreichen", () => {
    // Hoher Regen + starkes Gewittersignal.
    const hourly = makeHourly({
      weatherCode: 95,
      precipitationMm: 40,
      cape: 2200,
      liftedIndex: -5,
    });
    const r = buildNowcast({
      hourly,
      minutely: Array.from({ length: 8 }, (_, i) => ({
        time: new Date(Date.now() + i * 15 * 60_000).toISOString(),
        precipitationMm: 10, // -> 40 mm/h
        precipitationProbability: 90,
        weatherCode: 95,
      })),
      now: new Date(),
      radarTopDbz: 60,
    });
    expect(r.subs.rain.value).toBeGreaterThanOrEqual(45);
    expect(r.subs.thunder.value).toBeGreaterThanOrEqual(45);
    expect(r.total).toBeGreaterThanOrEqual(60);
  });
});

describe("thunderSubscore — Radar-Echo gegen Niederschlag", () => {
  const point = (precipMm: number, code?: number): HourlyPoint => ({
    time: new Date().toISOString(),
    temperatureC: 20,
    precipitationMm: precipMm,
    weatherCode: code,
  });

  it("radarTopDbz=55 ohne Niederschlag -> Radar trägt 0 Punkte bei", () => {
    const s = thunderSubscore(point(0), { radarTopDbz: 55 });
    // Subscore-Value sollte 0 sein, da nur Radar verfügbar wäre und es nicht zählt.
    expect(s.value).toBe(0);
    // pickTop blendet 0-Punkt-Beiträge aus, also dürfen keine Radar-Punkte sichtbar sein.
    const radarVisible = s.contributors.find((x) => x.label.startsWith("Radar-Echo"));
    expect(radarVisible).toBeUndefined();
  });

  it("radarTopDbz=55 mit Niederschlag 3 mm -> 40 Radar-Punkte", () => {
    const s = thunderSubscore(point(3), { radarTopDbz: 55 });
    const radar = s.contributors.find((x) => x.label === "Radar-Echo");
    expect(radar).toBeDefined();
    expect(radar!.points).toBe(40);
  });
});

describe("dataConfidence — radarPrecipConflict-Strafe", () => {
  it("senkt value um 25 Punkte ggü. false", () => {
    const a = dataConfidence({ ...baseCtx, radarPrecipConflict: false });
    const b = dataConfidence({ ...baseCtx, radarPrecipConflict: true });
    expect(a.value - b.value).toBe(25);
  });
});

describe("Nowcast vs. Tages-Modus — K-Index/TT-Fehlalarm", () => {
  // Morgens, stabil: niedrige CAPE, leicht positive LI, K~31, TT~45, kein Niederschlag.
  // Werte so wählen, dass K-Index = T850 - T500 + Td850 - (T700 - Td700) ≈ 31
  // und Total Totals = T850 + Td850 - 2*T500 ≈ 45.
  // T850=10, T500=-25, Td850=4, T700=-5, Td700=-15 -> K = 35 + 4 - 10 = 29
  // Wir nehmen: T850=12, T500=-25, Td850=6, T700=-5, Td700=-12 -> K = 37+6-7 = 36
  // TT = 12 + 6 - 2*(-25) = 68 -> zu hoch. Reduziere T850.
  // T850=2, T500=-25, Td850=-2, T700=-5, Td700=-12 -> K = 27 + -2 - 7 = 18, TT= 2-2+50=50
  // Das genaue Zahlenmatch ist für den Test nicht kritisch — Hauptsache: Tages-Modus
  // sieht ein Signal aus K/TT, Nowcast-Modus nicht.
  const morningPoint: HourlyPoint = {
    time: new Date().toISOString(),
    temperatureC: 14,
    precipitationMm: 0,
    cape: 120,
    liftedIndex: 0.5,
    convectiveInhibition: 0,
    temperature850hPa: 12,
    temperature700hPa: -5,
    temperature500hPa: -25,
    dewPoint850hPa: 10,
    dewPoint700hPa: -10,
  };

  it("nowcast-Modus liefert ~0, Tages-Modus liefert >0", () => {
    const ncMode = thunderSubscore(morningPoint, { nowcast: true });
    const dayMode = thunderSubscore(morningPoint);
    expect(ncMode.value).toBeLessThanOrEqual(5);
    expect(dayMode.value).toBeGreaterThan(ncMode.value);
  });

  it("buildNowcast2h und buildNowcast liefern denselben severeScore/total pro Step", () => {
    const hourly: HourlyPoint[] = Array.from({ length: 4 }, (_, i) => ({
      ...morningPoint,
      time: new Date(Date.now() + i * 3600_000).toISOString(),
    }));
    const now = new Date();
    const a = buildNowcast({ hourly, now });
    const b = buildNowcast2h(hourly, undefined, now);
    expect(b.steps.length).toBe(a.steps.length);
    for (let i = 0; i < a.steps.length; i++) {
      expect(b.steps[i].severeScore).toBe(a.steps[i].total);
    }
  });
});