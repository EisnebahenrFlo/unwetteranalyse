import type { WeatherModelId, WeatherModelInfo } from "./types";

const H = (cape: boolean, liftedIndex: boolean, cin: boolean, gusts: boolean) => ({
  cape,
  liftedIndex,
  cin,
  gusts,
});

/**
 * Reihenfolge: hochauflösende Modelle zuerst. hazards-Flags geben an, welche
 * Konvektions-/Gefahren-Parameter Open-Meteo für das jeweilige Modell wirklich
 * liefert (empirisch verifiziert, Stand 2026).
 */
export const WEATHER_MODELS: WeatherModelInfo[] = [
  {
    id: "icon_d2",
    label: "ICON-D2 (DWD)",
    provider: "DWD",
    resolutionKm: 2.1,
    region: "DACH",
    horizonHours: 48,
    hazards: H(true, false, false, true),
  },
  {
    id: "meteoswiss_icon_ch1",
    label: "ICON-CH1 (MeteoSwiss)",
    provider: "MeteoSwiss",
    resolutionKm: 1.0,
    region: "Alpenraum",
    horizonHours: 33,
    hazards: H(true, false, true, true),
  },
  {
    id: "meteofrance_arome_france",
    label: "AROME (Météo-France)",
    provider: "Météo-France",
    resolutionKm: 1.3,
    region: "Frankreich/Alpenraum",
    horizonHours: 51,
    hazards: H(true, false, false, true),
  },
  {
    id: "meteoswiss_icon_ch2",
    label: "ICON-CH2 (MeteoSwiss)",
    provider: "MeteoSwiss",
    resolutionKm: 2.0,
    region: "Alpenraum",
    horizonHours: 120,
    hazards: H(true, false, true, true),
  },
  {
    id: "italia_meteo_arpae_icon_2i",
    label: "ICON-2I (ItaliaMeteo)",
    provider: "ItaliaMeteo-ARPAE",
    resolutionKm: 2.0,
    region: "Südalpen/Italien",
    horizonHours: 72,
    hazards: H(true, false, true, true),
  },
  {
    id: "icon_eu",
    label: "ICON-EU (DWD)",
    provider: "DWD",
    resolutionKm: 6.5,
    region: "Europa",
    horizonHours: 120,
    hazards: H(true, false, false, true),
  },
  {
    id: "meteofrance_arpege_europe",
    label: "ARPEGE Europe",
    provider: "Météo-France",
    resolutionKm: 10,
    region: "Europa",
    horizonHours: 102,
    hazards: H(true, false, false, true),
  },
  {
    id: "icon_seamless",
    label: "ICON Seamless",
    provider: "DWD",
    resolutionKm: 11,
    region: "Global",
    horizonHours: 180,
    hazards: H(true, false, false, true),
  },
  {
    id: "ukmo_seamless",
    label: "UKMO Seamless",
    provider: "UK Met Office",
    resolutionKm: 10,
    region: "Europa/Global",
    horizonHours: 156,
    hazards: H(true, false, true, true),
  },
  {
    id: "gem_seamless",
    label: "GEM (Kanada)",
    provider: "MSC",
    resolutionKm: 15,
    region: "Global",
    horizonHours: 228,
    hazards: H(true, false, false, true),
  },
  {
    id: "knmi_seamless",
    label: "HARMONIE/KNMI",
    provider: "KNMI",
    resolutionKm: 2,
    region: "Nordwesteuropa",
    horizonHours: 348,
    hazards: H(true, false, true, true),
  },
  {
    id: "dmi_seamless",
    label: "DMI Seamless",
    provider: "DMI",
    resolutionKm: 2.5,
    region: "Nordeuropa",
    horizonHours: 348,
    hazards: H(true, false, true, true),
  },
  {
    id: "ecmwf_ifs025",
    label: "ECMWF IFS 0.25°",
    provider: "ECMWF",
    resolutionKm: 25,
    region: "Global",
    horizonHours: 348,
    hazards: H(true, false, false, true),
  },
  {
    id: "gfs_seamless",
    label: "GFS (NOAA)",
    provider: "NOAA",
    resolutionKm: 25,
    region: "Global",
    horizonHours: 384,
    hazards: H(true, true, true, true),
  },
  {
    id: "ecmwf_aifs025",
    label: "ECMWF AIFS",
    provider: "ECMWF",
    resolutionKm: 25,
    region: "Global KI",
    horizonHours: 240,
    hazards: H(false, false, false, false),
  },
];

export function getModelInfo(id: WeatherModelId) {
  return WEATHER_MODELS.find((m) => m.id === id);
}

/** Alle Modelle, die wenigstens CAPE liefern (also alles außer AIFS). */
export const HAZARD_MODELS = WEATHER_MODELS.filter((m) => m.hazards.cape);
