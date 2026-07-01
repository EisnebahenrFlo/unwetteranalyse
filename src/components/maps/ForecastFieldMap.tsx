import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl, { type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TempField } from "@/lib/weather/maps/temperature-field";
import { drawField, fieldCorners } from "@/lib/weather/maps/field-render";

export interface ForecastFieldMapHandle {
  update: (field: TempField, hourIdx: number, opacity: number) => void;
  flyTo: (lon: number, lat: number, zoom?: number) => void;
}

interface Props {
  initialCenter: { lat: number; lon: number };
  initialZoom?: number;
  onPick?: (lat: number, lon: number) => void;
  showLabels?: boolean;
}

export const ForecastFieldMap = forwardRef<ForecastFieldMapHandle, Props>(function ForecastFieldMap(
  { initialCenter, initialZoom = 5.2, onPick, showLabels = true },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const addedRef = useRef(false);
  const labelsAddedRef = useRef(false);
  const showLabelsRef = useRef(showLabels);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const isDark = () =>
      typeof document !== "undefined" && document.documentElement.classList.contains("dark");
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
          {
            id: "bg",
            type: "background",
            paint: { "background-color": isDark() ? "#0D1318" : "#e6ecf2" },
          },
          {
            id: "osm",
            type: "raster",
            source: "osm",
            paint: isDark()
              ? {
                  "raster-saturation": -1,
                  "raster-brightness-max": 0.45,
                  "raster-brightness-min": 0,
                  "raster-contrast": -0.1,
                  "raster-opacity": 0.85,
                }
              : { "raster-saturation": -0.5, "raster-brightness-max": 0.95 },
          },
        ],
      },
      center: [initialCenter.lon, initialCenter.lat],
      zoom: initialZoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    mapRef.current = map;
    const applyTheme = () => {
      if (!readyRef.current) return;
      const dark = isDark();
      if (map.getLayer("bg")) {
        map.setPaintProperty("bg", "background-color", dark ? "#0D1318" : "#e6ecf2");
      }
      if (map.getLayer("osm")) {
        map.setPaintProperty("osm", "raster-saturation", dark ? -1 : -0.5);
        map.setPaintProperty("osm", "raster-brightness-max", dark ? 0.45 : 0.95);
        map.setPaintProperty("osm", "raster-brightness-min", dark ? 0 : 0);
        map.setPaintProperty("osm", "raster-contrast", dark ? -0.1 : 0);
        map.setPaintProperty("osm", "raster-opacity", dark ? 0.85 : 1);
      }
    };
    map.on("load", () => {
      readyRef.current = true;
      map.resize();
      applyTheme();
    });
    const themeObserver =
      typeof MutationObserver !== "undefined" ? new MutationObserver(applyTheme) : null;
    if (themeObserver && typeof document !== "undefined") {
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
    if (onPick) {
      map.on("click", (e) => onPick(e.lngLat.lat, e.lngLat.lng));
    }
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      themeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
      addedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    update(field, hourIdx, opacity) {
      const map = mapRef.current;
      if (!map) return;
      const apply = () => {
        if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
        const canvas = canvasRef.current;
        drawField(canvas, field, hourIdx);
        if (!addedRef.current) {
          if (map.getLayer("temp-field-lyr")) map.removeLayer("temp-field-lyr");
          if (map.getSource("temp-field-src")) map.removeSource("temp-field-src");
          map.addSource("temp-field-src", {
            type: "canvas",
            canvas,
            coordinates: fieldCorners(field),
            animate: true,
          });
          map.addLayer({
            id: "temp-field-lyr",
            type: "raster",
            source: "temp-field-src",
            paint: { "raster-opacity": opacity, "raster-resampling": "linear" },
          });
          addedRef.current = true;
        } else {
          map.setPaintProperty("temp-field-lyr", "raster-opacity", opacity);
        }

        // Labels: Source/Layer beim ersten Mal anlegen, danach nur setData.
        if (!labelsAddedRef.current) {
          if (map.getLayer("temp-labels-lyr")) map.removeLayer("temp-labels-lyr");
          if (map.getSource("temp-labels-src")) map.removeSource("temp-labels-src");
          map.addSource("temp-labels-src", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "temp-labels-lyr",
            type: "symbol",
            source: "temp-labels-src",
            layout: {
              "text-field": ["get", "t"],
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4,
                10,
                7,
                13,
              ],
              "text-allow-overlap": false,
              "text-ignore-placement": false,
              "text-padding": 2,
              visibility: showLabelsRef.current ? "visible" : "none",
            },
            paint: {
              "text-color": "#0b1220",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.4,
            },
          });
          labelsAddedRef.current = true;
        }
        const features: GeoJSON.Feature[] = [];
        const { nLat, nLon, lats, lons, temps } = field;
        const base = hourIdx * nLat * nLon;
        for (let y = 0; y < nLat; y++) {
          for (let x = 0; x < nLon; x++) {
            const v = temps[base + y * nLon + x];
            if (!Number.isFinite(v)) continue;
            features.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: [lons[x], lats[y]] },
              properties: { t: String(Math.round(v)) },
            });
          }
        }
        const src = map.getSource("temp-labels-src") as maplibregl.GeoJSONSource | undefined;
        src?.setData({ type: "FeatureCollection", features });
      };
      if (readyRef.current) apply();
      else map.once("load", apply);
    },
    flyTo(lon, lat, zoom) {
      mapRef.current?.flyTo({
        center: [lon, lat],
        zoom: zoom ?? mapRef.current.getZoom(),
        duration: 700,
      });
    },
  }));

  useEffect(() => {
    showLabelsRef.current = showLabels;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (!map.getLayer("temp-labels-lyr")) return;
    map.setLayoutProperty("temp-labels-lyr", "visibility", showLabels ? "visible" : "none");
  }, [showLabels]);

  return <div ref={containerRef} className="h-full w-full" />;
});