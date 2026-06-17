import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "@tanstack/react-query";
import { dwdRadarTileUrl, fetchDwdRadarFrames } from "@/lib/weather/sources/dwd-radar";
import { Layers, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GeoPoint } from "@/lib/weather/types";

interface Props {
  center: GeoPoint;
  layer: "radar" | "precipitation" | "none";
}

export function WeatherMap({ center, layer }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  const radarQ = useQuery({
    queryKey: ["dwd-radar"],
    queryFn: fetchDwdRadarFrames,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // init
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
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
          { id: "bg", type: "background", paint: { "background-color": "#e8eef4" } },
          { id: "osm", type: "raster", source: "osm" },
        ],
      },
      center: [center.lon, center.lat],
      zoom: 7,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    mapRef.current = map;
    // Falls Container erst spät seine Größe bekommt (z. B. Tab-Wechsel),
    // ein Resize nachreichen, sonst bleibt die Karte unsichtbar.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(ref.current);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // recenter when active point changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [center.lon, center.lat], zoom: 7, duration: 700 });
  }, [center.lat, center.lon]);

  // radar frames
  const frames = useMemo(() => radarQ.data ?? [], [radarQ.data]);

  useEffect(() => {
    if (frames.length > 0) setFrameIdx(frames.length - 1);
  }, [frames.length]);

  useEffect(() => {
    if (!playing || frames.length === 0 || layer !== "radar") return;
    const id = window.setInterval(() => setFrameIdx((i) => (i + 1) % frames.length), 800);
    return () => window.clearInterval(id);
  }, [playing, frames.length, layer]);

  // update radar overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      ["radar-layer"].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      ["radar-src"].forEach((id) => { if (map.getSource(id)) map.removeSource(id); });
      if (layer !== "radar") return;
      const frame = frames[Math.min(frameIdx, frames.length - 1)];
      map.addSource("radar-src", {
        type: "raster",
        tiles: [dwdRadarTileUrl(frame?.time)],
        tileSize: 256,
      });
      map.addLayer({ id: "radar-layer", type: "raster", source: "radar-src", paint: { "raster-opacity": 0.7 } });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [layer, frameIdx, frames]);

  const currentFrame = frames[frameIdx];

  return (
    <div className="relative h-[60vh] min-h-[400px] w-full overflow-hidden rounded-lg border border-border">
      <div ref={ref} className="absolute inset-0" />
      {layer === "radar" && currentFrame && (
        <div className="absolute bottom-3 left-3 right-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-background/90 px-3 py-2 backdrop-blur">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={frameIdx}
            onChange={(e) => { setPlaying(false); setFrameIdx(Number(e.target.value)); }}
            className="min-w-0 accent-primary"
          />
          <div className="shrink-0 font-mono text-xs text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
            {new Date(currentFrame.time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-border bg-background/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
        <Layers className="mr-1 inline h-3 w-3" />
        Radar: DWD · Karte: OpenStreetMap
      </div>
    </div>
  );
}
