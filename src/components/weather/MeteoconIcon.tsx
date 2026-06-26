import clearDay from "@/assets/meteocons/clear-day.svg";
import clearNight from "@/assets/meteocons/clear-night.svg";
import drizzle from "@/assets/meteocons/drizzle.svg";
import fogDay from "@/assets/meteocons/fog-day.svg";
import fogNight from "@/assets/meteocons/fog-night.svg";
import overcast from "@/assets/meteocons/overcast.svg";
import partlyCloudyDay from "@/assets/meteocons/partly-cloudy-day.svg";
import partlyCloudyNight from "@/assets/meteocons/partly-cloudy-night.svg";
import rain from "@/assets/meteocons/rain.svg";
import snow from "@/assets/meteocons/snow.svg";
import thunderstormsDayRain from "@/assets/meteocons/thunderstorms-day-rain.svg";
import thunderstormsNightRain from "@/assets/meteocons/thunderstorms-night-rain.svg";
import wind from "@/assets/meteocons/wind.svg";
import thermometer from "@/assets/meteocons/thermometer.svg";
import windsock from "@/assets/meteocons/windsock.svg";
import raindrop from "@/assets/meteocons/raindrop.svg";
import barometer from "@/assets/meteocons/barometer.svg";
import compass from "@/assets/meteocons/compass.svg";
import hail from "@/assets/meteocons/hail.svg";
import sleet from "@/assets/meteocons/sleet.svg";
import tornado from "@/assets/meteocons/tornado.svg";
import { cn } from "@/lib/utils";

type MeteoconName =
  | "clear-day"
  | "clear-night"
  | "partly-cloudy-day"
  | "partly-cloudy-night"
  | "overcast"
  | "fog-day"
  | "fog-night"
  | "drizzle"
  | "rain"
  | "thunderstorms-day-rain"
  | "thunderstorms-night-rain"
  | "snow"
  | "sleet"
  | "hail"
  | "wind"
  | "thermometer"
  | "windsock"
  | "raindrop"
  | "barometer"
  | "compass"
  | "tornado";

const ICONS: Record<MeteoconName, string> = {
  "clear-day": clearDay,
  "clear-night": clearNight,
  "partly-cloudy-day": partlyCloudyDay,
  "partly-cloudy-night": partlyCloudyNight,
  overcast,
  "fog-day": fogDay,
  "fog-night": fogNight,
  drizzle,
  rain,
  "thunderstorms-day-rain": thunderstormsDayRain,
  "thunderstorms-night-rain": thunderstormsNightRain,
  snow,
  sleet,
  hail,
  wind,
  thermometer,
  windsock,
  raindrop,
  barometer,
  compass,
  tornado,
};

export function MeteoconIcon({
  code,
  name,
  label,
  className,
  isNight,
}: {
  code?: number;
  name?: MeteoconName;
  label?: string;
  className?: string;
  isNight?: boolean;
}) {
  const iconName = name ?? meteoconNameForCode(code, isNight);
  return (
    <img
      src={ICONS[iconName]}
      alt={label ?? iconName}
      className={cn("h-10 w-10 shrink-0", className)}
      loading="lazy"
    />
  );
}

export function meteoconNameForCode(code: number | undefined, isNight = false): MeteoconName {
  if (code == null) return "partly-cloudy-day";
  if (code === 0) return isNight ? "clear-night" : "clear-day";
  if (code === 1 || code === 2) return isNight ? "partly-cloudy-night" : "partly-cloudy-day";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return isNight ? "fog-night" : "fog-day";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code))
    return isNight ? "thunderstorms-night-rain" : "thunderstorms-day-rain";
  return isNight ? "partly-cloudy-night" : "partly-cloudy-day";
}

/**
 * Bestimmt anhand der DailyPoints (Sonnenauf-/-untergang), ob ein gegebener
 * Zeitpunkt in der Nacht liegt. Fallback ohne sunrise/sunset: 20 – 06 Uhr lokal.
 */
export function isNightAt(
  timeIso: string,
  daily?: { date: string; sunrise?: string; sunset?: string }[],
): boolean {
  const t = new Date(timeIso);
  if (Number.isNaN(t.getTime())) return false;
  const day = daily?.find((d) => d.date === timeIso.slice(0, 10));
  if (day?.sunrise && day?.sunset) {
    const rise = new Date(day.sunrise).getTime();
    const set = new Date(day.sunset).getTime();
    const ts = t.getTime();
    return ts < rise || ts >= set;
  }
  const h = t.getHours();
  return h < 6 || h >= 20;
}
