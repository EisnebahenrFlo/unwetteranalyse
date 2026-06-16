import type { Settings } from "../storage/settings";

export function formatTemp(value: number | undefined, unit: Settings["tempUnit"] = "C"): string {
  if (value == null || Number.isNaN(value)) return "—";
  const v = unit === "F" ? value * 1.8 + 32 : value;
  return `${v.toFixed(1)} °${unit}`;
}

export function msToBeaufort(ms: number): number {
  const table = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
  for (let i = 0; i < table.length; i++) if (ms < table[i]) return i;
  return 12;
}

export function formatWind(ms: number | undefined, unit: Settings["windUnit"] = "kmh"): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (unit === "ms") return `${ms.toFixed(1)} m/s`;
  if (unit === "bft") return `Bft ${msToBeaufort(ms)}`;
  return `${(ms * 3.6).toFixed(0)} km/h`;
}

export function formatPrecip(mm: number | undefined): string {
  if (mm == null) return "—";
  return `${mm.toFixed(mm < 1 ? 1 : 0)} mm`;
}

export function formatPressure(hpa: number | undefined): string {
  if (hpa == null) return "—";
  return `${hpa.toFixed(0)} hPa`;
}

export function formatPercent(value: number | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(0)} %`;
}

export function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function formatRelative(iso: string): string {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return rtf.format(diffH, "hour");
  return rtf.format(Math.round(diffH / 24), "day");
}

export function windDirectionLabel(deg: number | undefined): string {
  if (deg == null) return "—";
  const dirs = ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function weatherCodeLabel(code: number | undefined): string {
  if (code == null) return "—";
  const map: Record<number, string> = {
    0:"Klar",1:"Überwiegend klar",2:"Teils bewölkt",3:"Bedeckt",
    45:"Nebel",48:"Reifnebel",
    51:"Leichter Nieselregen",53:"Nieselregen",55:"Starker Nieselregen",
    61:"Leichter Regen",63:"Regen",65:"Starker Regen",
    66:"Gefrierender Regen",67:"Starker gefr. Regen",
    71:"Leichter Schneefall",73:"Schneefall",75:"Starker Schneefall",77:"Schneegriesel",
    80:"Regenschauer",81:"Kräftiger Schauer",82:"Heftiger Schauer",
    85:"Schneeschauer",86:"Kräftiger Schneeschauer",
    95:"Gewitter",96:"Gewitter mit Hagel",99:"Schweres Gewitter",
  };
  return map[code] ?? "—";
}
