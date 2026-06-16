import type { WeatherModelInfo } from "./types";

export const WEATHER_MODELS: WeatherModelInfo[] = [
  { id: "icon_d2", label: "ICON-D2 (DWD)", provider: "DWD", resolutionKm: 2.1, region: "DACH", horizonHours: 48 },
  { id: "icon_eu", label: "ICON-EU (DWD)", provider: "DWD", resolutionKm: 6.5, region: "Europa", horizonHours: 120 },
  { id: "ecmwf_ifs025", label: "ECMWF IFS 0.25°", provider: "ECMWF", resolutionKm: 25, region: "Global", horizonHours: 240 },
  { id: "gfs_seamless", label: "GFS (NOAA)", provider: "NOAA", resolutionKm: 25, region: "Global", horizonHours: 240 },
  { id: "meteofrance_arome_france", label: "AROME (Météo-France)", provider: "Météo-France", resolutionKm: 1.3, region: "Frankreich/Alpenraum", horizonHours: 48 },
];
