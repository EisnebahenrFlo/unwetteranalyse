import { SOUNDING_LEVELS, type SoundingRaw } from "./fetch";

export interface SoundingLevel {
  pressureHpa: number;
  heightMslM: number;
  heightAglM: number;
  temperatureC: number;
  dewPointC: number;
  windU: number;
  windV: number;
  windSpeedMs: number;
  windDirDeg: number;
}

export interface Vec {
  u: number;
  v: number;
  speedMs: number;
  dirDeg: number;
}

export interface SoundingKinematics {
  shear01Ms: number;
  shear03Ms: number;
  shear06Ms: number;
  srh01: number;
  srh03: number;
  meanWind06: Vec;
  stormRight: Vec;
  stormLeft: Vec;
}

export interface SoundingProfile {
  time: string;
  surfaceElevationM: number;
  levels: SoundingLevel[];
  kinematics: SoundingKinematics | null;
  cape: number | null;
  cin: number | null;
  liftedIndex: number | null;
  lclHeightAglM: number | null;
}

function dewPoint(tC: number, rh: number): number {
  const a = 17.625,
    b = 243.04;
  const r = Math.min(100, Math.max(1, rh)) / 100;
  const alpha = Math.log(r) + (a * tC) / (b + tC);
  return (b * alpha) / (a - alpha);
}

function uvFrom(speed: number, dirDeg: number): { u: number; v: number } {
  const r = (dirDeg * Math.PI) / 180;
  return { u: -speed * Math.sin(r), v: -speed * Math.cos(r) };
}
function dirFromUV(u: number, v: number): number {
  const raw = (Math.atan2(-u, -v) * 180) / Math.PI;
  return raw < 0 ? raw + 360 : raw;
}
function vec(u: number, v: number): Vec {
  const speedMs = Math.hypot(u, v);
  return { u, v, speedMs, dirDeg: (dirFromUV(u, v) + 360) % 360 };
}

export function buildSounding(raw: SoundingRaw, hourIndex: number): SoundingProfile | null {
  const h = raw.hourly;
  const time = h.time?.[hourIndex];
  if (!time) return null;
  const surfaceElevationM = raw.elevation ?? 0;

  const levels: SoundingLevel[] = [];
  for (const p of SOUNDING_LEVELS) {
    const t = h[`temperature_${p}hPa`]?.[hourIndex];
    const rh = h[`relative_humidity_${p}hPa`]?.[hourIndex];
    const spd = h[`wind_speed_${p}hPa`]?.[hourIndex];
    const dir = h[`wind_direction_${p}hPa`]?.[hourIndex];
    const gz = h[`geopotential_height_${p}hPa`]?.[hourIndex];
    if (t == null || gz == null) continue;
    const { u, v } = uvFrom(spd ?? 0, dir ?? 0);
    levels.push({
      pressureHpa: p,
      heightMslM: gz,
      heightAglM: Math.max(0, gz - surfaceElevationM),
      temperatureC: t,
      dewPointC: rh != null ? dewPoint(t, rh) : t - 30,
      windU: u,
      windV: v,
      windSpeedMs: spd ?? 0,
      windDirDeg: dir ?? 0,
    });
  }
  if (levels.length < 4) return null;
  levels.sort((a, b) => a.heightAglM - b.heightAglM);

  const cape = h.cape?.[hourIndex] ?? null;
  const cin = h.convective_inhibition?.[hourIndex] ?? null;
  const liftedIndex = h.lifted_index?.[hourIndex] ?? null;
  const t2 = h.temperature_2m?.[hourIndex];
  const td2 = h.dew_point_2m?.[hourIndex];
  const lclHeightAglM = t2 != null && td2 != null ? Math.max(0, 125 * (t2 - td2)) : null;

  return {
    time,
    surfaceElevationM,
    levels,
    kinematics: computeKinematics(levels),
    cape,
    cin,
    liftedIndex,
    lclHeightAglM,
  };
}

function windAt(levels: SoundingLevel[], hAgl: number): { u: number; v: number } {
  const first = levels[0],
    last = levels[levels.length - 1];
  if (hAgl <= first.heightAglM) return { u: first.windU, v: first.windV };
  if (hAgl >= last.heightAglM) return { u: last.windU, v: last.windV };
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1],
      b = levels[i];
    if (hAgl <= b.heightAglM) {
      const f = (hAgl - a.heightAglM) / (b.heightAglM - a.heightAglM);
      return {
        u: a.windU + f * (b.windU - a.windU),
        v: a.windV + f * (b.windV - a.windV),
      };
    }
  }
  return { u: last.windU, v: last.windV };
}

function meanWind(levels: SoundingLevel[], lo: number, hi: number): { u: number; v: number } {
  let su = 0,
    sv = 0,
    n = 0;
  for (let z = lo; z <= hi; z += 250) {
    const w = windAt(levels, z);
    su += w.u;
    sv += w.v;
    n++;
  }
  return n ? { u: su / n, v: sv / n } : { u: 0, v: 0 };
}

function srh(levels: SoundingLevel[], topAgl: number, c: { u: number; v: number }): number {
  let sum = 0;
  const step = 100;
  let prev = windAt(levels, 0);
  for (let z = step; z <= topAgl; z += step) {
    const cur = windAt(levels, z);
    sum += (cur.u - c.u) * (prev.v - c.v) - (prev.u - c.u) * (cur.v - c.v);
    prev = cur;
  }
  return sum;
}

function computeKinematics(levels: SoundingLevel[]): SoundingKinematics | null {
  const top = levels[levels.length - 1].heightAglM;
  if (top < 3000) return null;

  const sfc = windAt(levels, 0);
  const shearMag = (hAgl: number) => {
    const w = windAt(levels, hAgl);
    return Math.hypot(w.u - sfc.u, w.v - sfc.v);
  };
  const shear06Ms = top >= 6000 ? shearMag(6000) : shearMag(top);

  const mean06 = meanWind(levels, 0, Math.min(6000, top));
  const w6 = windAt(levels, Math.min(6000, top));
  const shrU = w6.u - sfc.u,
    shrV = w6.v - sfc.v;
  const mag = Math.hypot(shrU, shrV) || 1;
  const D = 7.5;
  const stormRight = vec(mean06.u + D * (shrV / mag), mean06.v + D * (-shrU / mag));
  const stormLeft = vec(mean06.u - D * (shrV / mag), mean06.v - D * (-shrU / mag));

  return {
    shear01Ms: shearMag(1000),
    shear03Ms: shearMag(3000),
    shear06Ms,
    srh01: srh(levels, 1000, stormRight),
    srh03: srh(levels, 3000, stormRight),
    meanWind06: vec(mean06.u, mean06.v),
    stormRight,
    stormLeft,
  };
}