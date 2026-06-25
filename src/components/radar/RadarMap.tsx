import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LightningStrike } from "@/lib/weather/sources/blitzortung";
import { classifyAge } from "@/lib/weather/sources/blitzortung";
import type { CellTrack } from "@/lib/weather/analysis/cockpit-diagnostics";
import type { StormCell } from "@/lib/weather/storm/types";
import { SEVERITY_COLOR, SEVERITY_BADGE } from "@/components/storm/severity-tokens";
import {
  etaToNearestTarget,
  type NamedTarget,
} from "@/lib/weather/storm/estimate";

/** 64-Punkt-Approximation eines Kreises in Lon/Lat um (lat, lon) mit Radius in km. */
function ringCoords(lat: number, lon: number, km: number, steps = 64): [number, number][] {
  const coords: [number, number][] = [];
  const latKm = 111.32;
  const lonKm = 111.32 * Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lon + (km * Math.cos(a)) / lonKm, lat + (km * Math.sin(a)) / latKm]);
  }
  return coords;
}

export interface RadarMapHandle {
  setRasterTiles: (id: string, tileUrl: string | null, opacity?: number) => void;
  /**
   * Verwaltet einen vorgeladenen Frame-Stack für flüssige Animation.
   * Alle Frames bleiben als Layer gemountet, nur die Opazität wird gewechselt
   * → kein Tile-Refetch beim Scrubben/Playback und weicher Crossfade.
   */
  setFrameStack: (
    stackKey: string,
    frames: { time: string; url: string }[],
    activeTime: string | null,
    opacity: number,
  ) => void;
  setLightning: (strikes: LightningStrike[]) => void;
  setCellTrack: (track: CellTrack | null) => void;
  setStormCells: (cells: StormCell[]) => void;
  setNamedTargets: (targets: NamedTarget[]) => void;
  getBbox: () => [number, number, number, number] | null;
  flyTo: (lon: number, lat: number, zoom?: number) => void;
  setFocusRings: (center: { lat: number; lon: number } | null, kmRadii?: number[]) => void;
}

interface Props {
  initialCenter: { lat: number; lon: number };
  initialZoom?: number;
  onBboxChange?: (bbox: [number, number, number, number]) => void;
  onInteractionChange?: (busy: boolean) => void;
}

/**
 * Schlanke Map-Shell für das Radar-Cockpit.
 * Layer-Verwaltung erfolgt imperativ über das exponierte Handle,
 * damit React-Renders die Karte nicht zerstören.
 */
export const RadarMap = forwardRef<RadarMapHandle, Props>(function RadarMap(
  { initialCenter, initialZoom = 6.5, onBboxChange, onInteractionChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  /** Aktive Frame-Stacks: key → Liste der gemounteten (sourceId, layerId, time, url). */
  const stacksRef = useRef<Map<string, { sourceId: string; layerId: string; time: string; url: string }[]>>(new Map());
  /** Letzte bekannte Zellen + Ziele, damit Label-Refreshes ohne neuen setStormCells funktionieren. */
  const cellsRef = useRef<StormCell[]>([]);
  const targetsRef = useRef<NamedTarget[]>([]);

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
      center: [initialCenter.lon, initialCenter.lat],
      zoom: initialZoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    mapRef.current = map;

    const emitBbox = () => {
      const b = map.getBounds();
      onBboxChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };

    map.on("load", () => {
      readyRef.current = true;
      map.resize();
      emitBbox();
      // Leerer Lightning-Source initialisieren.
      map.addSource("lightning-src", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "lightning-layer",
        type: "circle",
        source: "lightning-src",
        paint: {
          "circle-radius": ["match", ["get", "age"], "fresh", 5, "recent", 4, 3],
          "circle-color": ["match", ["get", "age"], "fresh", "#facc15", "recent", "#f59e0b", "#9ca3af"],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#1f2937",
          "circle-opacity": ["match", ["get", "age"], "fresh", 0.95, "recent", 0.7, 0.4],
        },
      });
      // Fokusringe (Relevanzradius) als geojson polygon + labels.
      map.addSource("focus-rings-src", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "focus-rings-line",
        type: "line",
        source: "focus-rings-src",
        paint: {
          "line-color": "#0ea5e9",
          "line-width": 1.2,
          "line-dasharray": [2, 2],
          "line-opacity": 0.75,
        },
      });
      map.addSource("focus-labels-src", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "focus-labels",
        type: "symbol",
        source: "focus-labels-src",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-anchor": "left",
          "text-offset": [0.4, 0],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#0c4a6e",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      });
      map.addSource("focus-center-src", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "focus-center",
        type: "circle",
        source: "focus-center-src",
        paint: {
          "circle-radius": 5,
          "circle-color": "#0ea5e9",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      /* ----------- Stormtrack-Layer ----------- */
      const emptyFC = { type: "FeatureCollection" as const, features: [] };
      map.addSource("track-past-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "track-past",
        type: "line",
        source: "track-past-src",
        paint: {
          "line-color": "#ef4444",
          "line-width": 3,
          "line-opacity": 0.85,
        },
      });
      map.addSource("track-forecast-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "track-forecast",
        type: "line",
        source: "track-forecast-src",
        paint: {
          "line-color": "#ef4444",
          "line-width": 2.5,
          "line-dasharray": [1.5, 1.5],
          "line-opacity": 0.9,
        },
      });
      map.addSource("track-points-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "track-points",
        type: "circle",
        source: "track-points-src",
        paint: {
          "circle-radius": ["match", ["get", "kind"], "fresh", 6, "forecast", 5, 4],
          "circle-color": ["match", ["get", "kind"], "fresh", "#ef4444", "forecast", "#fff", "#fca5a5"],
          "circle-stroke-color": "#ef4444",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "track-labels",
        type: "symbol",
        source: "track-points-src",
        layout: {
          "text-field": ["coalesce", ["get", "label"], ""],
          "text-size": 10,
          "text-anchor": "left",
          "text-offset": [0.6, 0],
          "text-allow-overlap": true,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#7f1d1d",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      });

      /* ----------- Storm-Cells: Cone, Polygon, Forecast-Pfade ----------- */
      map.addSource("storm-cone-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "storm-cone",
        type: "fill",
        source: "storm-cone-src",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.10,
          "fill-outline-color": ["get", "color"],
        },
      });
      // Zugbahn vergangener Centroiden je Zelle.
      map.addSource("storm-past-halo-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "storm-past-halo",
        type: "line",
        source: "storm-past-halo-src",
        paint: {
          "line-color": "#ffffff",
          "line-width": 3.2,
          "line-opacity": 0.55,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addSource("storm-past-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "storm-past-line",
        type: "line",
        source: "storm-past-src",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
          "line-opacity": 0.55,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addSource("storm-past-pts-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "storm-past-pts",
        type: "circle",
        source: "storm-past-pts-src",
        paint: {
          "circle-radius": 2.5,
          "circle-color": ["get", "color"],
          "circle-opacity": ["coalesce", ["get", "fade"], 0.6],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addSource("storm-poly-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "storm-poly-fill",
        type: "fill",
        source: "storm-poly-src",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "storm-poly-line",
        type: "line",
        source: "storm-poly-src",
        paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-opacity": 0.9 },
      });
      map.addSource("storm-fc-line-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "storm-fc-line",
        type: "line",
        source: "storm-fc-line-src",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-dasharray": [2, 1.4],
          "line-opacity": 0.92,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      // Pfeilspitze am Ende der Prognose (Bewegungsrichtung).
      map.addSource("storm-fc-arrow-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "storm-fc-arrow",
        type: "symbol",
        source: "storm-fc-arrow-src",
        layout: {
          "text-field": "▲",
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 12, 8, 16, 12, 22],
          "text-rotation-alignment": "map",
          "text-pitch-alignment": "map",
          "text-rotate": ["coalesce", ["get", "bearing"], 0],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-anchor": "center",
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.8,
        },
      });
      // ETA-Marker (+15/+30/+60 min) entlang des Forecasts.
      map.addSource("storm-eta-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "storm-eta-pts",
        type: "circle",
        source: "storm-eta-src",
        paint: {
          "circle-radius": 4,
          "circle-color": "#ffffff",
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "storm-eta-labels",
        type: "symbol",
        source: "storm-eta-src",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-anchor": "left",
          "text-offset": [0.6, 0],
          "text-allow-overlap": true,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.6,
        },
      });
      map.addSource("storm-centroid-src", { type: "geojson", data: emptyFC });
      map.addLayer({
        id: "storm-centroid",
        type: "circle",
        source: "storm-centroid-src",
        paint: {
          "circle-radius": 6,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "storm-labels",
        type: "symbol",
        source: "storm-centroid-src",
        layout: {
          "text-field": [
            "step", ["zoom"],
            ["get", "labelShort"],
            7, ["get", "labelMid"],
            9, ["get", "labelFull"],
          ],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 7, 11, 10, 13],
          "text-anchor": "top-left",
          "text-offset": [0.9, 0.5],
          "text-justify": "left",
          "text-line-height": 1.15,
          "text-padding": 4,
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "symbol-sort-key": ["coalesce", ["get", "sortKey"], 0],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": ["coalesce", ["get", "textColor"], "#0f172a"],
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
    });

    map.on("movestart", () => onInteractionChange?.(true));
    map.on("moveend", () => { onInteractionChange?.(false); emitBbox(); });
    map.on("zoomend", emitBbox);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
      stacksRef.current.clear();
    };
    // initial-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    setRasterTiles(id, tileUrl, opacity = 0.72) {
      const map = mapRef.current;
      if (!map) return;
      const apply = () => {
        const layerId = `${id}-layer`;
        const sourceId = `${id}-src`;
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        if (!tileUrl) return;
        // tileSize 512 halbiert die Anzahl der Requests gegenüber 256 bei gleichem Viewport.
        map.addSource(sourceId, { type: "raster", tiles: [tileUrl], tileSize: 512, attribution: "© Deutscher Wetterdienst" });
        // Unter Lightning einfügen, damit Blitze sichtbar bleiben.
        const before = firstOverlayLayer(map);
        map.addLayer(
          {
            id: layerId,
            type: "raster",
            source: sourceId,
            paint: { "raster-opacity": opacity, "raster-fade-duration": 120 },
          },
          before,
        );
      };
      if (readyRef.current) apply();
      else map.once("load", apply);
    },
    setFrameStack(stackKey, frames, activeTime, opacity) {
      const map = mapRef.current;
      if (!map) return;
      const apply = () => {
        const before = firstOverlayLayer(map);
        const existing = stacksRef.current.get(stackKey) ?? [];
        const incomingTimes = new Set(frames.map((f) => f.time));
        // Entferne Frames, die nicht mehr im neuen Set sind.
        for (const e of existing) {
          if (!incomingTimes.has(e.time)) {
            if (map.getLayer(e.layerId)) map.removeLayer(e.layerId);
            if (map.getSource(e.sourceId)) map.removeSource(e.sourceId);
          }
        }
        const keep = new Map(existing.filter((e) => incomingTimes.has(e.time)).map((e) => [e.time, e]));
        const next: { sourceId: string; layerId: string; time: string; url: string }[] = [];
        for (const f of frames) {
          let entry = keep.get(f.time);
          // Falls URL sich änderte (z. B. anderer Layerschlüssel im selben Stack), neu anlegen.
          if (entry && entry.url !== f.url) {
            if (map.getLayer(entry.layerId)) map.removeLayer(entry.layerId);
            if (map.getSource(entry.sourceId)) map.removeSource(entry.sourceId);
            entry = undefined;
          }
          if (!entry) {
            const safe = f.time.replace(/[^0-9]/g, "");
            const sourceId = `${stackKey}-src-${safe}`;
            const layerId = `${stackKey}-lyr-${safe}`;
            map.addSource(sourceId, {
              type: "raster",
              tiles: [f.url],
              tileSize: 512,
              attribution: "© Deutscher Wetterdienst",
            });
            map.addLayer(
              {
                id: layerId,
                type: "raster",
                source: sourceId,
                paint: {
                  "raster-opacity": 0,
                  "raster-opacity-transition": { duration: 180, delay: 0 },
                  "raster-fade-duration": 120,
                },
              },
              before,
            );
            entry = { sourceId, layerId, time: f.time, url: f.url };
          }
          next.push(entry);
        }
        // Opazitäten setzen — nur aktiver Frame sichtbar, andere bleiben im Cache.
        for (const e of next) {
          const isActive = e.time === activeTime;
          map.setPaintProperty(e.layerId, "raster-opacity", isActive ? opacity : 0);
        }
        stacksRef.current.set(stackKey, next);
      };
      if (readyRef.current) apply();
      else map.once("load", apply);
    },
    setLightning(strikes) {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      const src = map.getSource("lightning-src") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      const now = Date.now();
      src.setData({
        type: "FeatureCollection",
        features: strikes.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lon, s.lat] },
          properties: { age: classifyAge(s.time, now), time: s.time },
        })),
      });
    },
    setCellTrack(track) {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      const pastSrc = map.getSource("track-past-src") as maplibregl.GeoJSONSource | undefined;
      const fcSrc = map.getSource("track-forecast-src") as maplibregl.GeoJSONSource | undefined;
      const ptsSrc = map.getSource("track-points-src") as maplibregl.GeoJSONSource | undefined;
      if (!pastSrc || !fcSrc || !ptsSrc) return;
      const empty = { type: "FeatureCollection" as const, features: [] };
      if (!track || !track.freshCentroid) {
        pastSrc.setData(empty); fcSrc.setData(empty); ptsSrc.setData(empty);
        return;
      }
      type Feat = {
        type: "Feature";
        geometry: { type: "Point"; coordinates: [number, number] };
        properties: Record<string, unknown>;
      };
      const features: Feat[] = [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [track.freshCentroid.lon, track.freshCentroid.lat] },
          properties: {
            kind: "fresh",
            label: track.speedKmh != null && track.bearingCompass
              ? `${Math.round(track.speedKmh)} km/h ${track.bearingCompass}`
              : "Zelle",
          },
        },
      ];
      if (track.olderCentroid && track.hasTrack) {
        pastSrc.setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [track.olderCentroid.lon, track.olderCentroid.lat],
                [track.freshCentroid.lon, track.freshCentroid.lat],
              ],
            },
            properties: {},
          }],
        });
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [track.olderCentroid.lon, track.olderCentroid.lat] },
          properties: { kind: "older" },
        });
      } else {
        pastSrc.setData(empty);
      }
      if (track.forecastPosition) {
        fcSrc.setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [track.freshCentroid.lon, track.freshCentroid.lat],
                [track.forecastPosition.lon, track.forecastPosition.lat],
              ],
            },
            properties: {},
          }],
        });
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [track.forecastPosition.lon, track.forecastPosition.lat] },
          properties: { kind: "forecast", label: `+${track.forecastPosition.offsetMinutes} min` },
        });
      } else {
        fcSrc.setData(empty);
      }
      ptsSrc.setData({ type: "FeatureCollection", features });
    },
    setFocusRings(center, kmRadii = [10, 25, 50, 100]) {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      const ringsSrc = map.getSource("focus-rings-src") as maplibregl.GeoJSONSource | undefined;
      const labelsSrc = map.getSource("focus-labels-src") as maplibregl.GeoJSONSource | undefined;
      const centerSrc = map.getSource("focus-center-src") as maplibregl.GeoJSONSource | undefined;
      if (!ringsSrc || !labelsSrc || !centerSrc) return;
      if (!center) {
        const empty = { type: "FeatureCollection" as const, features: [] };
        ringsSrc.setData(empty); labelsSrc.setData(empty); centerSrc.setData(empty);
        return;
      }
      const ringFeatures = kmRadii.map((km) => ({
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [ringCoords(center.lat, center.lon, km)] },
        properties: { km },
      }));
      const labelFeatures = kmRadii.map((km) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [center.lon + (km / 111.32) / Math.cos((center.lat * Math.PI) / 180), center.lat] },
        properties: { label: `${km} km` },
      }));
      ringsSrc.setData({ type: "FeatureCollection", features: ringFeatures });
      labelsSrc.setData({ type: "FeatureCollection", features: labelFeatures });
      centerSrc.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "Point", coordinates: [center.lon, center.lat] }, properties: {} }],
      });
    },
    setStormCells(cells) {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      cellsRef.current = cells;
      renderStormCells(map, cells, targetsRef.current);
    },
    setNamedTargets(targets) {
      targetsRef.current = targets;
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      renderStormCells(map, cellsRef.current, targets);
    },
    getBbox() {
      const map = mapRef.current;
      if (!map) return null;
      const b = map.getBounds();
      return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    },
    flyTo(lon, lat, zoom) {
      mapRef.current?.flyTo({ center: [lon, lat], zoom: zoom ?? mapRef.current.getZoom(), duration: 700 });
    },
  }));

  return <div ref={containerRef} className="h-full w-full" />;
});

/** Schreibt Storm-Cell-Geometrien + Labels in alle storm-* GeoJSON-Sources. */
function renderStormCells(map: MlMap, cells: StormCell[], targets: NamedTarget[]) {
      const coneSrc = map.getSource("storm-cone-src") as maplibregl.GeoJSONSource | undefined;
      const polySrc = map.getSource("storm-poly-src") as maplibregl.GeoJSONSource | undefined;
      const fcSrc = map.getSource("storm-fc-line-src") as maplibregl.GeoJSONSource | undefined;
      const cenSrc = map.getSource("storm-centroid-src") as maplibregl.GeoJSONSource | undefined;
      const pastSrc = map.getSource("storm-past-src") as maplibregl.GeoJSONSource | undefined;
      const pastHaloSrc = map.getSource("storm-past-halo-src") as maplibregl.GeoJSONSource | undefined;
      const pastPtsSrc = map.getSource("storm-past-pts-src") as maplibregl.GeoJSONSource | undefined;
      const etaSrc = map.getSource("storm-eta-src") as maplibregl.GeoJSONSource | undefined;
      const arrowSrc = map.getSource("storm-fc-arrow-src") as maplibregl.GeoJSONSource | undefined;
      if (!coneSrc || !polySrc || !fcSrc || !cenSrc || !pastSrc || !pastHaloSrc || !pastPtsSrc || !etaSrc || !arrowSrc) return;
      const empty = { type: "FeatureCollection" as const, features: [] };
      if (cells.length === 0) {
        coneSrc.setData(empty); polySrc.setData(empty); fcSrc.setData(empty); cenSrc.setData(empty);
        pastSrc.setData(empty); pastHaloSrc.setData(empty); pastPtsSrc.setData(empty);
        etaSrc.setData(empty); arrowSrc.setData(empty);
        return;
      }
      type AnyFeature = {
        type: "Feature";
        geometry:
          | { type: "Polygon"; coordinates: number[][][] }
          | { type: "LineString"; coordinates: number[][] }
          | { type: "Point"; coordinates: number[] };
        properties: Record<string, unknown>;
      };
      const cones: AnyFeature[] = [];
      const polys: AnyFeature[] = [];
      const fcLines: AnyFeature[] = [];
      const centroids: AnyFeature[] = [];
      const pastLines: AnyFeature[] = [];
      const pastHalos: AnyFeature[] = [];
      const pastPts: AnyFeature[] = [];
      const etaPts: AnyFeature[] = [];
      const arrows: AnyFeature[] = [];
      const ETA_OFFSETS = [15, 30, 60];
      const SEV_RANK: Record<string, number> = { calm: 0, watch: 1, serious: 2, severe: 3 };

      for (const cell of cells) {
        const color = SEVERITY_COLOR[cell.severity.level];
        if (cell.cone.length >= 4) {
          cones.push({
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [cell.cone] },
            properties: { color, id: cell.id },
          });
        }
        if (cell.polygon.length >= 3) {
          const ring = [...cell.polygon, cell.polygon[0]];
          polys.push({
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [ring] },
            properties: { color, id: cell.id },
          });
        }
        // Zugbahn: history (älteste → neueste) + aktueller Centroid.
        if (cell.history.length >= 2) {
          const coords: [number, number][] = cell.history.map((h) => [h.lon, h.lat]);
          pastHalos.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: coords },
            properties: { id: cell.id },
          });
          pastLines.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: coords },
            properties: { color, id: cell.id },
          });
          // Nur jeden 2. Punkt rendern, älteste deutlich verblasst.
          const n = cell.history.length;
          cell.history.forEach((h, i) => {
            if (i % 2 !== 0 && i !== n - 1) return;
            const fade = 0.2 + 0.55 * (i / Math.max(1, n - 1));
            pastPts.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: [h.lon, h.lat] },
              properties: { color, fade },
            });
          });
        }
        if (cell.forecast.length > 0) {
          fcLines.push({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [cell.centroid.lon, cell.centroid.lat],
                ...cell.forecast.map((f) => [f.lon, f.lat] as [number, number]),
              ],
            },
            properties: { color, id: cell.id },
          });
          for (const off of ETA_OFFSETS) {
            const fp = cell.forecast.find((f) => f.offsetMin === off);
            if (!fp) continue;
            etaPts.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: [fp.lon, fp.lat] },
              properties: { color, label: `+${off} min` },
            });
          }
          // Pfeilspitze am Ende der Forecast-Linie, Rotation aus Bewegungsrichtung.
          const tip = cell.forecast[cell.forecast.length - 1];
          const bearing = cell.motion?.bearingDeg ?? 0;
          arrows.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [tip.lon, tip.lat] },
            properties: { color, bearing },
          });
        }
        // Zoom-abhängige Labels: kurz / mittel / lang.
        const name = cell.displayName ?? cell.id;
        const badge = SEVERITY_BADGE[cell.severity.level];
        const labelShort = `${name} · ${badge}`;
        const motionLine = cell.motion && cell.motion.speedKmh > 1
          ? `${Math.round(cell.motion.speedKmh)} km/h → ${cell.motion.bearingCompass}`
          : null;
        const labelMid = motionLine ? `${labelShort}\n${motionLine}` : labelShort;
        const eta = etaToNearestTarget(cell, targets);
        const etaLine = eta ? `→ ${eta.target.name} ${eta.minutes} min` : null;
        const labelFull = [labelShort, motionLine, etaLine].filter(Boolean).join("\n");
        centroids.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [cell.centroid.lon, cell.centroid.lat] },
          properties: {
            color,
            id: cell.id,
            labelShort,
            labelMid,
            labelFull,
            textColor: cell.severity.level === "severe" || cell.severity.level === "extreme" ? "#7f1d1d" : "#0f172a",
            // Höchste Severity zuerst platzieren (großer sort-key = höhere Priorität bei Kollision).
            rank: SEV_RANK[cell.severity.level] ?? 0,
            // Negativer Sort-Key, damit MapLibre die wichtigsten zuerst rendert.
            sortKey: -(SEV_RANK[cell.severity.level] ?? 0),
          },
        });
      }

      coneSrc.setData({ type: "FeatureCollection", features: cones as unknown as never[] });
      polySrc.setData({ type: "FeatureCollection", features: polys as unknown as never[] });
      fcSrc.setData({ type: "FeatureCollection", features: fcLines as unknown as never[] });
      cenSrc.setData({ type: "FeatureCollection", features: centroids as unknown as never[] });
      pastSrc.setData({ type: "FeatureCollection", features: pastLines as unknown as never[] });
      pastHaloSrc.setData({ type: "FeatureCollection", features: pastHalos as unknown as never[] });
      pastPtsSrc.setData({ type: "FeatureCollection", features: pastPts as unknown as never[] });
      etaSrc.setData({ type: "FeatureCollection", features: etaPts as unknown as never[] });
      arrowSrc.setData({ type: "FeatureCollection", features: arrows as unknown as never[] });
}

/**
 * Liefert die ID der ersten "Overlay"-Schicht (Lightning/Track/Ringe), damit Raster
 * konsistent darunter einsortiert werden. Verhindert, dass neue Frames Blitze überdecken.
 */
function firstOverlayLayer(map: MlMap): string | undefined {
  for (const id of [
    "storm-cone", "storm-past-halo", "storm-past-line", "storm-past-pts", "storm-poly-fill", "storm-poly-line",
    "storm-fc-line", "storm-fc-arrow", "storm-eta-pts", "storm-eta-labels", "storm-centroid", "storm-labels",
    "track-past", "track-forecast", "track-points", "track-labels",
    "lightning-layer", "focus-rings-line", "focus-labels", "focus-center",
  ]) {
    if (map.getLayer(id)) return id;
  }
  return undefined;
}