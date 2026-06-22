import { useMemo } from "react";
import type { StormCell } from "@/lib/weather/storm/types";
import { SEVERITY_COLOR, SEVERITY_LABEL } from "./severity-tokens";

/**
 * Kompakte SVG-Visualisierung der Zugbahn einer Zelle:
 * vergangene Centroiden (durchgezogen) plus Forecast-Pfad (gestrichelt)
 * mit Pfeilspitze in Bewegungsrichtung.
 */
export function StormTrackMini({ cell }: { cell: StormCell }) {
  const { past, forecast, w, h, bbox, scaleKm, scalePx } = useMemo(() => normalize(cell), [cell]);

  if (past.length + forecast.length < 2) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-4 text-center text-[11px] text-muted-foreground">
        Noch keine Zugbahn — zu wenig Historie.
      </div>
    );
  }

  const color = SEVERITY_COLOR[cell.severity.level];
  const sevLabel = SEVERITY_LABEL[cell.severity.level];
  const pastD = polyToPath(past);
  const fcD = forecast.length >= 2 ? polyToPath(forecast) : "";
  const fresh = past[past.length - 1] ?? forecast[0];
  const tip = forecast[forecast.length - 1];
  // Pfeilspitze in Bewegungsrichtung am Ende des Forecast.
  const arrow = arrowHead(forecast);
  // Norden-Pfeil: SVG-y wächst nach unten → North zeigt nach -y.

  return (
    <div className="rounded-md border border-border/60 bg-card p-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label={`Zugbahn ${sevLabel}`}>
        <defs>
          <pattern id={`stm-grid-${cell.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.18" />
          </pattern>
          <radialGradient id={`stm-bg-${cell.id}`} cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor={color} stopOpacity="0.10" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={w} height={h} fill={`url(#stm-bg-${cell.id})`} />
        <rect x={0} y={0} width={w} height={h} fill={`url(#stm-grid-${cell.id})`} className="text-muted-foreground" />

        {/* Maßstabsbalken unten links */}
        <g transform={`translate(8 ${h - 10})`} className="text-muted-foreground">
          <line x1={0} y1={0} x2={scalePx} y2={0} stroke="currentColor" strokeWidth={1.2} />
          <line x1={0} y1={-3} x2={0} y2={3} stroke="currentColor" strokeWidth={1.2} />
          <line x1={scalePx} y1={-3} x2={scalePx} y2={3} stroke="currentColor" strokeWidth={1.2} />
          <text x={scalePx + 4} y={3} fontSize={9} fill="currentColor">{scaleKm} km</text>
        </g>

        {/* Nord-Indikator oben rechts */}
        <g transform={`translate(${w - 14} 14)`} className="text-muted-foreground">
          <circle r={9} fill="hsl(var(--background))" stroke="currentColor" strokeWidth={0.8} opacity={0.9} />
          <path d="M0 -6 L3 4 L0 1 L-3 4 Z" fill="currentColor" />
          <text x={0} y={-9} fontSize={8} textAnchor="middle" fill="currentColor">N</text>
        </g>

        {pastD && (
          <path d={pastD} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        )}
        {fcD && (
          <path d={fcD} fill="none" stroke={color} strokeWidth={2.2} strokeDasharray="5 3" strokeLinecap="round" opacity={0.95} />
        )}
        {past.map((p, i) => (
          <circle key={`p-${i}`} cx={p.x} cy={p.y} r={1.8} fill={color} opacity={0.35 + 0.55 * (i / Math.max(1, past.length - 1))} />
        ))}
        {arrow && (
          <polygon points={arrow} fill={color} opacity={0.95} />
        )}
        {fresh && (
          <>
            <circle cx={fresh.x} cy={fresh.y} r={6.5} fill={color} opacity={0.18} />
            <circle cx={fresh.x} cy={fresh.y} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
            <text x={fresh.x + 6} y={fresh.y - 6} fontSize={9} fill={color} fontWeight={600}>Jetzt</text>
          </>
        )}
        {tip && cell.forecast.length > 0 && (
          <text x={tip.x + 6} y={tip.y + 10} fontSize={9} fill={color} fontWeight={600}>
            +{cell.forecast[cell.forecast.length - 1].offsetMin} min
          </text>
        )}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-medium" style={{ color }}>
          {cell.motion ? `${Math.round(cell.motion.speedKmh)} km/h ${cell.motion.bearingCompass}` : "stationär"}
        </span>
        <span>
          Sicht {bbox.span.toFixed(0)} km · {cell.history.length} Track-Punkte
        </span>
      </div>
    </div>
  );
}

interface XY { x: number; y: number }

function normalize(cell: StormCell) {
  const pad = 8;
  const w = 240;
  const h = 112;
  const pts = [
    ...cell.history.map((p) => ({ lat: p.lat, lon: p.lon })),
    ...cell.forecast.map((f) => ({ lat: f.lat, lon: f.lon })),
  ];
  if (pts.length === 0) return { past: [] as XY[], forecast: [] as XY[], w, h, bbox: { span: 0 }, scaleKm: 0, scalePx: 0 };
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
  // Maßstab: schöne Schrittweite, max ~ ein Drittel der Breite.
  const pxPerKm = (w - 2 * pad) / spanX;
  const targetKm = (w / 3) / pxPerKm;
  const niceKm = niceStep(targetKm);
  return {
    past, forecast, w, h,
    bbox: { span: Math.max(dxKm, dyKm) },
    scaleKm: niceKm,
    scalePx: niceKm * pxPerKm,
  };
}

function polyToPath(pts: XY[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

/** Pfeilspitze als Polygon-Punkte am Ende des Forecast-Pfads. */
function arrowHead(pts: XY[]): string | null {
  if (pts.length < 2) return null;
  const tip = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return null;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const size = 7;
  const back = 4;
  const ax = tip.x - ux * back + px * (size / 2);
  const ay = tip.y - uy * back + py * (size / 2);
  const bx = tip.x - ux * back - px * (size / 2);
  const by = tip.y - uy * back - py * (size / 2);
  return `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
}

function niceStep(km: number): number {
  if (km <= 1) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(km)));
  const norm = km / pow;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * pow;
}