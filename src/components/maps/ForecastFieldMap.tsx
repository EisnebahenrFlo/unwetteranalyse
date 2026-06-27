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
}

export const ForecastFieldMap = forwardRef<ForecastFieldMapHandle, Props>(function ForecastFieldMap(
  { initialCenter, initialZoom = 5.2, onPick },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const addedRef = useRef(false);

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
          {
            id: "osm",
            type: "raster",
            source: "osm",
            paint: { "raster-saturation": -0.5, "raster-brightness-max": 0.95 },
          },
        ],
      },
      center: [initialCenter.lon, initialCenter.lat],
      zoom: initialZoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    mapRef.current = map;
    map.on("load", () => {
      readyRef.current = true;
      map.resize();
    });
    if (onPick) {
      map.on("click", (e) => onPick(e.lngLat.lat, e.lngLat.lng));
    }
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
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

  return <div ref={containerRef} className="h-full w-full" />;
});