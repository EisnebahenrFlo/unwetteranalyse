import type { DailyPoint, HourlyPoint } from "./types";

export function currentHourCutoff(now: Date) {
  const cutoff = new Date(now);
  cutoff.setMinutes(0, 0, 0);
  return cutoff;
}

export function liveHourly(hourly: HourlyPoint[], now: Date) {
  const cutoff = currentHourCutoff(now).getTime();
  return hourly.filter((point) => new Date(point.time).getTime() >= cutoff);
}

export function liveDaily(daily: DailyPoint[], now: Date) {
  const today = now.toISOString().slice(0, 10);
  return daily.filter((point) => point.date >= today);
}

export function isCurrentHour(iso: string, now: Date) {
  return new Date(iso).getTime() === currentHourCutoff(now).getTime();
}