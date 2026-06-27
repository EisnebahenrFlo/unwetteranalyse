// Live-Temperaturfeld DACH+Italien aus Open-Meteo (best_match), reguläres 0,75°-Gitter.
// Ein Bulk-Call mit Multi-Koordinaten -> 486 Punkte, 48 h. Client-seitig, CORS ok.

export const FIELD_BBOX = { latMin: 36, latMax: 55.5, lonMin: 5.5, lonMax: 18.7 } as const;
export const FIELD_STEP = 0.75;

export interface TempField {
  lats: number[];
  lons: number[];
  nLat: number;
  nLon: number;
  times: string[];
  temps: Float32Array;
  fetchedAt: number;
}

function range(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function buildGrid() {
  return {
    lats: range(FIELD_BBOX.latMin, FIELD_BBOX.latMax, FIELD_STEP),
    lons: range(FIELD_BBOX.lonMin, FIELD_BBOX.lonMax, FIELD_STEP),
  };
}

export async function fetchTemperatureField(signal?: AbortSignal): Promise<TempField> {
  const { lats, lons } = buildGrid();
  const nLat = lats.length;
  const nLon = lons.length;
  const latParams: number[] = [];
  const lonParams: number[] = [];
  for (let iLat = 0; iLat < nLat; iLat++) {
    for (let iLon = 0; iLon < nLon; iLon++) {
      latParams.push(lats[iLat]);
      lonParams.push(lons[iLon]);
    }
  }
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${latParams.join(",")}` +
    `&longitude=${lonParams.join(",")}` +
    "&hourly=temperature_2m&forecast_days=2&models=best_match&timezone=Europe%2FBerlin";

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = (await res.json()) as
    | Array<{ hourly: { time: string[]; temperature_2m: (number | null)[] } }>
    | { hourly: { time: string[]; temperature_2m: (number | null)[] } };
  const arr = Array.isArray(json) ? json : [json];
  const times = arr[0]?.hourly?.time ?? [];
  const nHour = times.length;
  const temps = new Float32Array(nHour * nLat * nLon);
  for (let p = 0; p < arr.length; p++) {
    const iLat = Math.floor(p / nLon);
    const iLon = p % nLon;
    const t = arr[p]?.hourly?.temperature_2m ?? [];
    for (let h = 0; h < nHour; h++) {
      const v = t[h];
      temps[h * nLat * nLon + iLat * nLon + iLon] = v == null ? NaN : v;
    }
  }
  return { lats, lons, nLat, nLon, times, temps, fetchedAt: Date.now() };
}