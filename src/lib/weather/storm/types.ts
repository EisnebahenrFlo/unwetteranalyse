/**
 * Domain-Typen für das Stormtracking.
 * Quelle: DWD-RADOLAN-RY (Reflektivitäts-Composite, 5 min, 1 km).
 * Zellen werden aus echten dBZ-Werten detektiert, Tracking erfolgt
 * frame-zu-frame über Centroid-Matching.
 */

export type StormSeverity = "calm" | "watch" | "serious" | "severe" | "extreme";

export interface StormCentroidPoint {
  time: number;
  lat: number;
  lon: number;
  /** Top-dBZ im Frame (für Trend, Fade-Renderings). */
  topDbz: number;
  /** Fläche in km² zum Snapshot-Zeitpunkt. */
  areaKm2: number;
}

export interface StormMotion {
  speedKmh: number;
  bearingDeg: number;
  bearingCompass: string;
  /** Wie zuverlässig ist die Bewegung (0..1)? */
  confidence: number;
}

export interface StormForecastPoint {
  offsetMin: number;
  lat: number;
  lon: number;
  /** Standardabweichung der Position in km (für Cone-Aufweitung). */
  sigmaKm: number;
}

export interface StormSeverityBreakdown {
  score: number;
  level: StormSeverity;
  reasons: string[];
}

export interface StormCell {
  id: string;
  /** Kompakter Anzeigename für Karten-Labels (z. B. "Zelle DE-A1"). */
  displayName?: string;
  firstSeen: number;
  lastSeen: number;
  centroid: { lat: number; lon: number };
  /** Konvexe Hülle der detektierten Pixel (lon, lat). */
  polygon: [number, number][];
  /** Charakteristischer Radius sqrt(area/π) in km. */
  radiusKm: number;
  /** Fläche der Zelle in km² (Pixel × Pixel-Fläche, Mercator-korrigiert). */
  areaKm2: number;
  /** Top-Reflektivität in dBZ. */
  topDbz: number;
  /** Pixelzahl im Hagelkern (≥57 dBZ). */
  hailCorePixels: number;
  /** Hagelkern-Fläche in km². */
  hailCoreAreaKm2: number;
  /** Trend Top-dBZ über die letzten 3 Frames (delta dBZ). */
  dbzTrend: number;
  /** Trend Fläche über die letzten 3 Frames (Verhältnis). */
  areaTrend: number;
  history: StormCentroidPoint[];
  motion: StormMotion | null;
  forecast: StormForecastPoint[];
  /** Cone-Polygon (lon, lat) als geschlossener Ring. */
  cone: [number, number][];
  severity: StormSeverityBreakdown;
}

export interface StormAlert {
  /** Stabiler Key: cellId + favoriteId. */
  id: string;
  cellId: string;
  favoriteId: string;
  favoriteName: string;
  etaMin: number;
  distanceKm: number;
  level: StormSeverity;
  createdAt: number;
  updatedAt: number;
}

export interface StormEnvironment {
  /** CAPE (J/kg) am Zellenort oder als regionale Proxy. */
  cape?: number;
  /** Lifted Index (°C). */
  liftedIndex?: number;
  /** Spitzenböe 10 m (m/s, Open-Meteo Forecast am Zellort/Region). */
  windGustMs?: number;
  /** Modell-Stunde, auf die sich CAPE/LI beziehen. */
  validFor?: string;
  /** 'cell' = am Zellen-Centroid, 'region' = aktiver Ort/Proxy. */
  source?: "cell" | "region";
}

export interface StormThresholds {
  /** Maximaler Centroid-Versatz zwischen Frames für ID-Match (km). */
  matchKm: number;
  /** Lebenszeit eines Tracks ohne Update (min). */
  ttlMin: number;
  /** Alert ETA-Schwelle (min). */
  alertEtaMin: number;
  /** Alert Severity-Schwelle. */
  alertLevel: StormSeverity;
  /** Cooldown pro Alert-ID (min). */
  alertCooldownMin: number;
  /** Treffer-Radius um Favorit (km), in dem Cone als "passing" gilt. */
  alertHitKm: number;
}

export const DEFAULT_STORM_THRESHOLDS: StormThresholds = {
  matchKm: 18,
  ttlMin: 25,
  alertEtaMin: 45,
  alertLevel: "serious",
  alertCooldownMin: 10,
  alertHitKm: 10,
};

export const SEVERITY_RANK: Record<StormSeverity, number> = {
  calm: 0,
  watch: 1,
  serious: 2,
  severe: 3,
  extreme: 4,
};