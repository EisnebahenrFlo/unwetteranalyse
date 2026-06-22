/**
 * Domain-Typen für das Stormtracking.
 * Detection basiert auf Blitzortung-Strikes (deterministisch, browser-tauglich),
 * Severity wird mit CAPE/LI aus Open-Meteo am aktiven Ort angereichert.
 */

export type StormSeverity = "calm" | "watch" | "serious" | "severe";

export interface StormCentroidPoint {
  time: number;
  lat: number;
  lon: number;
  strikes: number;
}

export interface StormMotion {
  speedKmh: number;
  bearingDeg: number;
  bearingCompass: string;
  /** Wie zuverlässig ist die Bewegung (0..1)? Basierend auf Historie + Streuung. */
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
  firstSeen: number;
  lastSeen: number;
  centroid: { lat: number; lon: number };
  /** Konvexe Hülle der aktuellen Strike-Wolke (lon, lat). */
  polygon: [number, number][];
  /** Räumliche Ausdehnung des Clusters in km (max Distanz vom Centroid). */
  radiusKm: number;
  /** Strikes im aktuellen Detection-Fenster. */
  strikeCount: number;
  /** Strikes pro Minute in den letzten 5 min. */
  strikeRatePerMin: number;
  /** Verhältnis Rate(letzte 5 min) / Rate(5–10 min). >1 = intensivierend. */
  strikeRateTrend: number;
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
  /** Wann der Alert erstmals erzeugt wurde. */
  createdAt: number;
  /** Wann zuletzt aktualisiert. */
  updatedAt: number;
}

export interface StormEnvironment {
  /** CAPE (J/kg). Idealerweise am Zellenort, sonst regionale Proxy. */
  cape?: number;
  /** Lifted Index (°C). Idealerweise am Zellenort, sonst regionale Proxy. */
  liftedIndex?: number;
  /** Modell-Stunde, auf die sich CAPE/LI beziehen. */
  validFor?: string;
  /** Woher die Werte stammen: 'cell' = am Zellen-Centroid, 'region' = aktiver Ort/Proxy. */
  source?: "cell" | "region";
}

export interface StormThresholds {
  /** Mindestabstand pro Cluster (km). */
  eps: number;
  /** Mindestpunkte für Core. */
  minPts: number;
  /** Fenster für Detection (Minuten). */
  windowMin: number;
  /** Maximaler Centroid-Versatz zwischen Frames für ID-Match (km). */
  matchKm: number;
  /** Wie lange ein Track ohne Update überlebt (Minuten). */
  ttlMin: number;
  /** Alert ETA-Schwelle (Minuten). */
  alertEtaMin: number;
  /** Alert Severity-Schwelle. */
  alertLevel: StormSeverity;
  /** Cooldown pro Alert-ID (Minuten). */
  alertCooldownMin: number;
  /** Treffer-Radius um Favorit (km), in dem Cone als "passing" gilt. */
  alertHitKm: number;
}

export const DEFAULT_STORM_THRESHOLDS: StormThresholds = {
  eps: 12,
  minPts: 3,
  windowMin: 20,
  matchKm: 25,
  ttlMin: 15,
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
};