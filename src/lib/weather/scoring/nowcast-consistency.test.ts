import { describe, it, expect } from "vitest";
import { buildNowcast } from "./nowcast";
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
  hasMinutely: true,
  hasUpperLevels: true,
  hasConvective: true,
  liveObsAgeMinutes: 5,
  radarAgeMinutes: 5,
  modelObsConsistent: true,
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
      precipitationMm: 12, // klarer Regen
    });
    const r = buildNowcast({
      hourly,
      minutely: Array.from({ length: 8 }, (_, i) => ({
        time: new Date(Date.now() + i * 15 * 60_000).toISOString(),
        precipitationMm: 3, // -> 12 mm/h
        precipitationProbability: 90,
        weatherCode: 95,
      })),
      now: new Date(),
      radarTopDbz: 55,
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

  it("radarTopDbz=55 ohne Niederschlag -> 0 Radar-Punkte, Label 'unbestätigt'", () => {
    const s = thunderSubscore(point(0), { radarTopDbz: 55 });
    const radar = s.contributors.find((x) => x.label.startsWith("Radar-Echo"));
    expect(radar).toBeDefined();
    expect(radar!.label).toContain("unbestätigt");
    expect(radar!.points).toBe(0);
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