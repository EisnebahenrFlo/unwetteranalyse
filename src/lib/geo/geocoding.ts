import type { GeoPoint } from "../weather/types";

const OPEN_METEO_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";

/** DACH + Norditalien werden in der Trefferliste nach oben sortiert. */
const DACH = new Set(["DE", "AT", "CH", "LI", "IT"]);

export type QueryKind = "coords" | "postal" | "name" | "empty";

/**
 * Erkennt, ob die Eingabe Koordinaten, eine Postleitzahl oder ein Ortsname ist.
 * Akzeptiert: "52.52, 13.405", "52.52 13.405", "52.52;13.405", "80331" usw.
 */
export function classifyQuery(raw: string): { kind: QueryKind; lat?: number; lon?: number } {
  const s = raw.trim();
  if (s.length === 0) return { kind: "empty" };

  // GPS: zwei Zahlen, getrennt durch Komma / Semikolon / Whitespace.
  const coordMatch = s.match(/^(-?\d{1,2}(?:\.\d+)?)[\s,;]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lon = Number(coordMatch[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { kind: "coords", lat, lon };
  }

  // PLZ: 4–5 reine Ziffern (CH/AT 4-stellig, DE 5-stellig).
  if (/^\d{4,5}$/.test(s)) return { kind: "postal" };

  return { kind: "name" };
}

interface OpenMeteoResult {
  latitude: number;
  longitude: number;
  name: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  elevation?: number;
  postcodes?: string[];
  population?: number;
  feature_code?: string;
}

function toGeoPoint(r: OpenMeteoResult, postalHint?: string): GeoPoint & { postal?: string; population?: number } {
  return {
    lat: r.latitude,
    lon: r.longitude,
    name: r.name,
    country: r.country_code,
    admin: r.admin1 ?? r.admin2,
    elevation: r.elevation,
    postal: postalHint ?? r.postcodes?.[0],
    population: r.population,
  };
}

/** DACH zuerst, danach nach Einwohnerzahl absteigend. */
function rankResults<T extends { country?: string; population?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aD = a.country && DACH.has(a.country) ? 1 : 0;
    const bD = b.country && DACH.has(b.country) ? 1 : 0;
    if (aD !== bD) return bD - aD;
    return (b.population ?? 0) - (a.population ?? 0);
  });
}

/**
 * Hauptsuche: erkennt Eingabetyp und liefert eine sortierte Trefferliste.
 * - Name & PLZ → Open-Meteo Geocoding
 * - GPS       → Reverse Geocoding via Nominatim (1 Treffer)
 */
export async function searchLocations(query: string, language = "de"): Promise<GeoPoint[]> {
  const cls = classifyQuery(query);
  if (cls.kind === "empty") return [];

  if (cls.kind === "coords" && cls.lat != null && cls.lon != null) {
    const reverse = await reverseGeocode(cls.lat, cls.lon, language).catch(() => null);
    if (reverse) return [reverse];
    return [{
      lat: cls.lat, lon: cls.lon,
      name: `${cls.lat.toFixed(4)}, ${cls.lon.toFixed(4)}`,
    }];
  }

  // Open-Meteo Geocoding kennt keine PLZ-Suche → über Nominatim auflösen,
  // beschränkt auf DACH inkl. Liechtenstein.
  if (cls.kind === "postal") {
    const postal = await searchByPostalCode(query.trim(), language);
    if (postal.length > 0) return postal;
    // Fallback: trotzdem versuchen, falls Nutzer was wie „1010" tippt.
  }

  const url = new URL(OPEN_METEO_GEOCODING);
  url.searchParams.set("name", query.trim());
  url.searchParams.set("language", language);
  url.searchParams.set("count", "15");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = (await res.json()) as { results?: OpenMeteoResult[] };
  const postalHint = cls.kind === "postal" ? query.trim() : undefined;
  const mapped = (data.results ?? []).map((r) => toGeoPoint(r, postalHint));
  return rankResults(mapped);
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimReverse["address"];
}

async function searchByPostalCode(postal: string, language: string): Promise<GeoPoint[]> {
  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set("postalcode", postal);
  url.searchParams.set("countrycodes", "de,at,ch,li,it");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "10");
  url.searchParams.set("accept-language", language);

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimSearchResult[];
  return data.map((r) => {
    const a = r.address ?? {};
    const name =
      a.city ?? a.town ?? a.village ?? a.municipality ?? a.hamlet ?? a.suburb ??
      r.display_name?.split(",")[0]?.trim() ?? postal;
    return {
      lat: Number(r.lat),
      lon: Number(r.lon),
      name,
      country: a.country_code?.toUpperCase(),
      admin: a.state ?? a.county,
      postal,
    };
  });
}

interface NominatimReverse {
  lat: string;
  lon: string;
  display_name?: string;
  address?: {
    city?: string; town?: string; village?: string; municipality?: string;
    hamlet?: string; suburb?: string; county?: string; state?: string;
    country?: string; country_code?: string; postcode?: string;
  };
}

/**
 * Reverse Geocoding über Nominatim (OpenStreetMap).
 * Wird für GPS-Eingaben und für „Meinen Standort nutzen" verwendet.
 */
export async function reverseGeocode(lat: number, lon: number, language = "de"): Promise<GeoPoint> {
  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "12"); // Stadt/Gemeinde-Ebene
  url.searchParams.set("accept-language", language);

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = (await res.json()) as NominatimReverse;
  const a = data.address ?? {};
  const name =
    a.city ?? a.town ?? a.village ?? a.municipality ?? a.hamlet ?? a.suburb ??
    data.display_name?.split(",")[0]?.trim() ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

  return {
    lat,
    lon,
    name,
    country: a.country_code?.toUpperCase(),
    admin: a.state ?? a.county,
  };
}

/**
 * Holt den aktuellen Standort per Browser-Geolocation und löst ihn in einen Ortsnamen auf.
 * Wirft eine sprechende Fehlermeldung, die direkt im UI angezeigt werden kann.
 */
export async function getCurrentLocation(language = "de"): Promise<GeoPoint> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation wird vom Browser nicht unterstützt.");
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      const msg =
        err.code === err.PERMISSION_DENIED ? "Standortzugriff verweigert. Bitte in den Browser-Einstellungen erlauben." :
        err.code === err.POSITION_UNAVAILABLE ? "Standort aktuell nicht verfügbar." :
        err.code === err.TIMEOUT ? "Standortabfrage hat zu lange gedauert." :
        "Standort konnte nicht ermittelt werden.";
      reject(new Error(msg));
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 });
  });
  return reverseGeocode(pos.coords.latitude, pos.coords.longitude, language);
}
