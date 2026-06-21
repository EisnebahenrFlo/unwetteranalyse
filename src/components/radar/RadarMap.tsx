import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LightningStrike } from "@/lib/weather/sources/blitzortung";
import { classifyAge } from "@/lib/weather/sources/blitzortung";

export interface RadarMapHandle {
  setRasterTiles: (id: string, tileUrl: string | null, opacity?: number) => void;
  setLightning: (strikes: LightningStrike[]) => void;
  getBbox: () => [number, number, number, number] | null;
  flyTo: (lon: number, lat: number, zoom?: number) => void;
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
        map.addSource(sourceId, { type: "raster", tiles: [tileUrl], tileSize: 256, attribution: "© Deutscher Wetterdienst" });
        // Unter Lightning einfügen, damit Blitze sichtbar bleiben.
        const before = map.getLayer("lightning-layer") ? "lightning-layer" : undefined;
        map.addLayer({ id: layerId, type: "raster", source: sourceId, paint: { "raster-opacity": opacity } }, before);
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