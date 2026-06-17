import clearDay from "@/assets/meteocons/clear-day.svg";
import drizzle from "@/assets/meteocons/drizzle.svg";
import fogDay from "@/assets/meteocons/fog-day.svg";
import overcast from "@/assets/meteocons/overcast.svg";
import partlyCloudyDay from "@/assets/meteocons/partly-cloudy-day.svg";
import rain from "@/assets/meteocons/rain.svg";
import snow from "@/assets/meteocons/snow.svg";
import thunderstormsDayRain from "@/assets/meteocons/thunderstorms-day-rain.svg";
import wind from "@/assets/meteocons/wind.svg";
import { cn } from "@/lib/utils";

type MeteoconName = "clear-day" | "partly-cloudy-day" | "overcast" | "fog-day" | "drizzle" | "rain" | "thunderstorms-day-rain" | "snow" | "wind";

const ICONS: Record<MeteoconName, string> = {
  "clear-day": clearDay,
  "partly-cloudy-day": partlyCloudyDay,
  overcast,
  "fog-day": fogDay,
  drizzle,
  rain,
  "thunderstorms-day-rain": thunderstormsDayRain,
  snow,
  wind,
};

export function MeteoconIcon({ code, name, label, className }: { code?: number; name?: MeteoconName; label?: string; className?: string }) {
  const iconName = name ?? meteoconNameForCode(code);
  return <img src={ICONS[iconName]} alt={label ?? iconName} className={cn("h-8 w-8 shrink-0", className)} loading="lazy" />;
}

export function meteoconNameForCode(code: number | undefined): MeteoconName {
  if (code == null) return "partly-cloudy-day";
  if (code === 0) return "clear-day";
  if (code === 1 || code === 2) return "partly-cloudy-day";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog-day";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunderstorms-day-rain";
  return "partly-cloudy-day";
}