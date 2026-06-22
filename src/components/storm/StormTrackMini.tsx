import { useMemo } from "react";
import type { StormCell } from "@/lib/weather/storm/types";
import { SEVERITY_COLOR } from "./severity-tokens";

/**
 * Kompakte SVG-Visualisierung der Zugbahn einer Zelle:
 * vergangene Centroiden (durchgezogen) plus Forecast-Pfad (gestrichelt)
 * mit Pfeilspitze in Bewegungsrichtung.
 */
export function StormTrackMini({ cell }: { cell: StormCell }) {
  const { past, forecast, w, h, bbox } = useMemo(() => normalize(cell), [cell]);

  if (past.length + forecast.length < 2) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-4 text-center text-[11px] text-muted-foreground">
        Noch keine Zugbahn — zu wenig Historie.
      </div>
    );
  }

  const color = SEVERITY_COLOR[cell.severity.level];
  const pastD = polyToPath(past);
  const fcD = forecast.length >= 2 ? polyToPath(forecast) : "";
  const fresh = past[past.length - 1] ?? forecast[0];
  const tip = forecast[forecast.length - 1];

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full">
        {/* Hilfsraster */}
        <rect x={0} y={0} width={w} height={h} fill="transparent" />
        {pastD && (
          <path d={pastD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        )}
        {fcD && (
          <path d={fcD} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" opacity={0.9} />
        )}
        {past.map((p, i) => (
          <circle key={`p-${i}`} cx={p.x} cy={p.y} r={1.6} fill={color} opacity={0.4 + 0.5 * (i / Math.max(1, past.length - 1))} />
        ))}
        {fresh && (
          <circle cx={fresh.x} cy={fresh.y} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
        )}
        {tip && (
          <circle cx={tip.x} cy={tip.y} r={3} fill="#fff" stroke={color} strokeWidth={1.5} />
        )}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{cell.motion ? `${Math.round(cell.motion.speedKmh)} km/h ${cell.motion.bearingCompass}` : "stationär"}</span>
        <span>
          {bbox.span.toFixed(0)} km · {cell.history.length} Punkte
          {cell.forecast.length > 0 && ` · +${cell.forecast[cell.forecast.length - 1].offsetMin} min`}
        </span>
      </div>
    </div>
  );
}

interface XY { x: number; y: number }

function normalize(cell: StormCell) {
  const pad = 8;
  const w = 240;
  const h = 96;
  const pts = [
    ...cell.history.map((p) => ({ lat: p.lat, lon: p.lon })),
    ...cell.forecast.map((f) => ({ lat: f.lat, lon: f.lon })),
  ];
  if (pts.length === 0) return { past: [] as XY[], forecast: [] as XY[], w, h, bbox: { span: 0 } };
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const cosLat = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const dxKm = (maxLon - minLon) * 111.32 * cosLat;
  const dyKm = (maxLat - minLat) * 111.32;
  const span = Math.max(dxKm, dyKm, 5);

  // Quadratisch normieren, Aspect erhalten.
  const aspect = (w - 2 * pad) / (h - 2 * pad);
  let spanX = span, spanY = span;
  if (dxKm / Math.max(0.1, dyKm) > aspect) spanY = spanX / aspect;
  else spanX = spanY * aspect;

  const cx = (minLon + maxLon) / 2;
  const cy = (minLat + maxLat) / 2;
  const projX = (lon: number) => {
    const km = (lon - cx) * 111.32 * cosLat;
    return pad + ((km + spanX / 2) / spanX) * (w - 2 * pad);
  };
  const projY = (lat: number) => {
    const km = (lat - cy) * 111.32;
    return h - pad - ((km + spanY / 2) / spanY) * (h - 2 * pad);
  };

  const past = cell.history.map((p) => ({ x: projX(p.lon), y: projY(p.lat) }));
  const forecast = [
    { x: projX(cell.centroid.lon), y: projY(cell.centroid.lat) },
    ...cell.forecast.map((f) => ({ x: projX(f.lon), y: projY(f.lat) })),
  ];
  return { past, forecast, w, h, bbox: { span: Math.max(dxKm, dyKm) } };
}

function polyToPath(pts: XY[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}