import { useEffect, useMemo, useRef } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StormCell } from "@/lib/weather/storm/types";
import { SEVERITY_COLOR } from "./severity-tokens";

/**
 * Echte Mini-Karte mit OSM-Basemap, Past-Track, Forecast-Cone, ETA-Markern
 * und Auto-Fit auf alle Track-Punkte. Eigenständige Map-Instanz, damit der
 * Drawer unabhängig vom Radar-Cockpit funktioniert.
 */
export function StormTrackMini({ cell }: { cell: StormCell }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);

  const color = SEVERITY_COLOR[cell.severity.level];
  const speed = cell.motion ? Math.round(cell.motion.speedKmh) : 0;
  const compass = cell.motion?.bearingCompass ?? "";

  // Map einmalig erzeugen.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#e6ecf2" } },
          { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.4, "raster-brightness-max": 0.95 } },
        ],
      },
      center: [cell.centroid.lon, cell.centroid.lat],
      zoom: 8,
      attributionControl: { compact: true },
      interactive: true,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false, showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      readyRef.current = true;
      const empty = { type: "FeatureCollection" as const, features: [] };
      map.addSource("mini-cone", { type: "geojson", data: empty });
      map.addLayer({
        id: "mini-cone-fill",
        type: "fill",
        source: "mini-cone",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.15, "fill-outline-color": ["get", "color"] },
      });
      map.addSource("mini-past", { type: "geojson", data: empty });
      map.addLayer({
        id: "mini-past-line",
        type: "line",
        source: "mini-past",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 3, "line-opacity": 0.85 },
      });
      map.addSource("mini-past-pts", { type: "geojson", data: empty });
      map.addLayer({
        id: "mini-past-pts",
        type: "circle",
        source: "mini-past-pts",
        paint: {
          "circle-radius": 3,
          "circle-color": ["get", "color"],
          "circle-opacity": ["coalesce", ["get", "fade"], 0.6],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });
      map.addSource("mini-fc", { type: "geojson", data: empty });
      map.addLayer({
        id: "mini-fc-line",
        type: "line",
        source: "mini-fc",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-dasharray": [2, 1.4],
          "line-opacity": 0.95,
        },
      });
      map.addSource("mini-eta", { type: "geojson", data: empty });
      map.addLayer({
        id: "mini-eta-pts",
        type: "circle",
        source: "mini-eta",
        paint: {
          "circle-radius": 5,
          "circle-color": "#ffffff",
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "mini-eta-labels",
        type: "symbol",
        source: "mini-eta",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-anchor": "left",
          "text-offset": [0.7, 0],
          "text-allow-overlap": true,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: { "text-color": "#1f2937", "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
      });
      map.addSource("mini-now", { type: "geojson", data: empty });
      map.addLayer({
        id: "mini-now-halo",
        type: "circle",
        source: "mini-now",
        paint: {
          "circle-radius": 12,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.18,
        },
      });
      map.addLayer({
        id: "mini-now-dot",
        type: "circle",
        source: "mini-now",
        paint: {
          "circle-radius": 6,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "mini-now-label",
        type: "symbol",
        source: "mini-now",
        layout: {
          "text-field": "Jetzt",
          "text-size": 11,
          "text-anchor": "left",
          "text-offset": [0.8, 0],
          "text-allow-overlap": true,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: { "text-color": ["get", "color"], "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
      });
      paint(map, cell);
      fit(map, cell);
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // initial-only — Cell-Updates werden im zweiten Effect übernommen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Daten- und Bounds-Updates bei Zelländerung.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    paint(map, cell);
    fit(map, cell);
  }, [cell]);

  const empty = cell.history.length < 1 && cell.forecast.length < 1;

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-card">
      <div ref={containerRef} className="h-56 w-full" />
      <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-[11px]">
        <span className="font-medium" style={{ color }}>
          {cell.motion && speed >= 1 ? `${speed} km/h ${compass}` : "stationär"}
        </span>
        <span className="text-muted-foreground">
          {cell.history.length} Track-Punkte
          {cell.forecast.length > 0 && ` · Prognose bis +${cell.forecast[cell.forecast.length - 1].offsetMin} min`}
          {empty && " · keine Historie"}
        </span>
      </div>
    </div>
  );
}

type AnyFeature = {
  type: "Feature";
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "LineString"; coordinates: number[][] }
    | { type: "Point"; coordinates: number[] };
  properties: Record<string, unknown>;
};

const ETA_OFFSETS = [15, 30, 60];

function paint(map: MlMap, cell: StormCell) {
  const color = SEVERITY_COLOR[cell.severity.level];
  const empty = { type: "FeatureCollection" as const, features: [] };

  const cone: AnyFeature[] = cell.cone.length >= 4
    ? [{ type: "Feature", geometry: { type: "Polygon", coordinates: [cell.cone] }, properties: { color } }]
    : [];

  const past: AnyFeature[] = cell.history.length >= 2
    ? [{
        type: "Feature",
        geometry: { type: "LineString", coordinates: cell.history.map((h) => [h.lon, h.lat]) },
        properties: { color },
      }]
    : [];

  const pastPts: AnyFeature[] = cell.history.map((h, i) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [h.lon, h.lat] },
    properties: {
      color,
      fade: 0.3 + 0.6 * (i / Math.max(1, cell.history.length - 1)),
    },
  }));

  const fc: AnyFeature[] = cell.forecast.length > 0
    ? [{
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [cell.centroid.lon, cell.centroid.lat],
            ...cell.forecast.map((f) => [f.lon, f.lat] as [number, number]),
          ],
        },
        properties: { color },
      }]
    : [];

  const etas: AnyFeature[] = [];
  for (const off of ETA_OFFSETS) {
    const fp = cell.forecast.find((f) => f.offsetMin === off);
    if (!fp) continue;
    etas.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [fp.lon, fp.lat] },
      properties: { color, label: `+${off}` },
    });
  }

  const now: AnyFeature[] = [{
    type: "Feature",
    geometry: { type: "Point", coordinates: [cell.centroid.lon, cell.centroid.lat] },
    properties: { color },
  }];

  (map.getSource("mini-cone") as maplibregl.GeoJSONSource | undefined)?.setData(
    cone.length ? { type: "FeatureCollection", features: cone as never[] } : empty,
  );
  (map.getSource("mini-past") as maplibregl.GeoJSONSource | undefined)?.setData(
    past.length ? { type: "FeatureCollection", features: past as never[] } : empty,
  );
  (map.getSource("mini-past-pts") as maplibregl.GeoJSONSource | undefined)?.setData(
    pastPts.length ? { type: "FeatureCollection", features: pastPts as never[] } : empty,
  );
  (map.getSource("mini-fc") as maplibregl.GeoJSONSource | undefined)?.setData(
    fc.length ? { type: "FeatureCollection", features: fc as never[] } : empty,
  );
  (map.getSource("mini-eta") as maplibregl.GeoJSONSource | undefined)?.setData(
    etas.length ? { type: "FeatureCollection", features: etas as never[] } : empty,
  );
  (map.getSource("mini-now") as maplibregl.GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: now as never[],
  });
}

function fit(map: MlMap, cell: StormCell) {
  const pts: [number, number][] = [
    [cell.centroid.lon, cell.centroid.lat],
    ...cell.history.map((h) => [h.lon, h.lat] as [number, number]),
    ...cell.forecast.map((f) => [f.lon, f.lat] as [number, number]),
    ...cell.cone.map((c) => [c[0], c[1]] as [number, number]),
  ];
  if (pts.length < 2) {
    map.easeTo({ center: [cell.centroid.lon, cell.centroid.lat], zoom: 9, duration: 400 });
    return;
  }
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of pts) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  // Minimal-Spannweite, damit zu kleine Cluster nicht überzoomen.
  const minSpanDeg = 0.15;
  if (maxLon - minLon < minSpanDeg) { const c = (maxLon + minLon) / 2; minLon = c - minSpanDeg / 2; maxLon = c + minSpanDeg / 2; }
  if (maxLat - minLat < minSpanDeg) { const c = (maxLat + minLat) / 2; minLat = c - minSpanDeg / 2; maxLat = c + minSpanDeg / 2; }
  map.fitBounds([[minLon, minLat], [maxLon, maxLat]], {
    padding: { top: 32, right: 32, bottom: 32, left: 32 },
    duration: 400,
    maxZoom: 11,
  });
}

// Memo-Hilfe ungenutzt, aber als Hook-Anker für künftige Erweiterungen.
export function __useStormCellSummary(cell: StormCell) {
  return useMemo(() => ({
    color: SEVERITY_COLOR[cell.severity.level],
    points: cell.history.length,
  }), [cell]);
}