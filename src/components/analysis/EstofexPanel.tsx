import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "@tanstack/react-query";
import { DataCard } from "@/components/common/DataCard";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { AlertTriangle, ChevronDown, ChevronUp } from "@/components/icons";
import { estofexQuery } from "@/lib/weather/queries";
import { estofexIsCurrent, estofexLevelAt, type EstofexLevel } from "@/lib/weather/estofex";
import type { EstofexForecast } from "@/lib/weather/sources/estofex.functions";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { useLiveNow } from "@/hooks/use-live-now";
import { formatHour } from "@/lib/weather/format";
import { cn } from "@/lib/utils";

/**
 * Bewusst NICHT die DWD-warn-Tokens verwenden — ESTOFEX-Level sind kein
 * amtlicher Warndienst und dürfen nicht mit DWD-Stufen verwechselt werden.
 */
const LEVEL_FILL: Record<1 | 2 | 3, string> = {
  1: "#F5D742", // gelblich
  2: "#F28C28", // orange
  3: "#D33F3F", // rot
};
const LEVEL_LABEL: Record<EstofexLevel, string> = {
  0: "außerhalb der Level-Gebiete",
  1: "Level 1",
  2: "Level 2",
  3: "Level 3",
};

export function EstofexPanel() {
  const point = useActivePoint();
  const now = useLiveNow();
  const q = useQuery(estofexQuery);

  const forecast = q.data;
  const isCurrent = forecast ? estofexIsCurrent(forecast, now) : false;
  const pointLevel: EstofexLevel = forecast
    ? estofexLevelAt(forecast, point.lon, point.lat)
    : 0;
  const hasLevels = (forecast?.levels?.length ?? 0) > 0;

  return (
    <DataCard
      title="ESTOFEX Outlook"
      subtitle="Convective Outlook eines Freiwilligenteams — kein amtlicher Warndienst."
    >
      {q.isLoading && <Skeleton className="h-64 w-full" />}

      {!q.isLoading && !hasLevels && (
        <EmptyState
          title="Kein aktueller ESTOFEX-Forecast"
          description="Aktuell liegt kein Storm-Forecast mit Level-Polygonen vor. Neuer Outlook erscheint unregelmäßig."
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      )}

      {!q.isLoading && forecast && hasLevels && (
        <div className="flex flex-col gap-3">
          <PointHeader
            level={pointLevel}
            isCurrent={isCurrent}
            issuedAt={forecast.issuedAt}
            validFrom={forecast.validFrom}
            validTo={forecast.validTo}
            forecaster={forecast.forecaster}
          />
          <EstofexMap forecast={forecast} centerLon={point.lon} centerLat={point.lat} />
          <Legend levels={forecast.levels.map((l) => l.level)} />
          {forecast.text && <ForecastText text={forecast.text} />}
          <Footer />
        </div>
      )}
    </DataCard>
  );
}

/* -------------------- Header -------------------- */

function PointHeader(props: {
  level: EstofexLevel;
  isCurrent: boolean;
  issuedAt?: string;
  validFrom?: string;
  validTo?: string;
  forecaster?: string;
}) {
  const { level, isCurrent, issuedAt, validFrom, validTo, forecaster } = props;
  const swatch = level === 0 ? "transparent" : LEVEL_FILL[level];
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background/50 p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-[3px] border",
            level === 0 ? "border-border" : "border-transparent",
          )}
          style={{ backgroundColor: swatch }}
          aria-hidden
        />
        <div className="text-sm">
          <span className="text-muted-foreground">Dein Standort: </span>
          <span className="font-display font-semibold text-foreground">
            {LEVEL_LABEL[level]}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {validFrom && validTo && (
          <span>
            Gültig{" "}
            <span className="font-mono tabular-nums text-foreground/80">
              {formatHour(validFrom)}
            </span>{" "}
            bis{" "}
            <span className="font-mono tabular-nums text-foreground/80">
              {formatHour(validTo)}
            </span>
          </span>
        )}
        {issuedAt && (
          <span>
            Ausgegeben{" "}
            <span className="font-mono tabular-nums text-foreground/80">
              {formatHour(issuedAt)}
            </span>
          </span>
        )}
        {forecaster && <span>Forecaster: {forecaster}</span>}
      </div>
      {!isCurrent && (
        <div className="flex items-start gap-2 rounded border border-warn-minor/40 bg-warn-minor/10 px-2 py-1.5 text-[11px] text-foreground/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-warn-minor" />
          <span>
            Kein gültiger aktueller Forecast — Anzeige als abgelaufen. Ein neuer Outlook
            erscheint typischerweise täglich, aber nicht garantiert.
          </span>
        </div>
      )}
    </div>
  );
}

/* -------------------- Karte -------------------- */

function EstofexMap(props: {
  forecast: EstofexForecast;
  centerLon: number;
  centerLat: number;
}) {
  const { forecast, centerLon, centerLat } = props;
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const geojson = useMemo(() => {
    const features = forecast.levels.flatMap((l) =>
      l.rings.map((ring) => ({
        type: "Feature" as const,
        properties: { level: l.level },
        geometry: { type: "Polygon" as const, coordinates: [ring] },
      })),
    );
    return { type: "FeatureCollection" as const, features };
  }, [forecast]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const container = ref.current;
    const map = new maplibregl.Map({
      container,
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
      center: [centerLon, centerLat],
      zoom: 4,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    mapRef.current = map;
    map.once("load", () => {
      map.addSource("estofex", { type: "geojson", data: geojson });
      map.addLayer({
        id: "estofex-fill",
        type: "fill",
        source: "estofex",
        paint: {
          "fill-color": [
            "match",
            ["get", "level"],
            1, LEVEL_FILL[1],
            2, LEVEL_FILL[2],
            3, LEVEL_FILL[3],
            "#999999",
          ],
          "fill-opacity": 0.25,
        },
      });
      map.addLayer({
        id: "estofex-outline",
        type: "line",
        source: "estofex",
        paint: {
          "line-color": [
            "match",
            ["get", "level"],
            1, LEVEL_FILL[1],
            2, LEVEL_FILL[2],
            3, LEVEL_FILL[3],
            "#666666",
          ],
          "line-width": 1.5,
        },
      });
      const marker = new maplibregl.Marker({ color: "#111" })
        .setLngLat([centerLon, centerLat])
        .addTo(map);
      markerRef.current = marker;
      map.resize();
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);
    return () => {
      ro.disconnect();
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marker bei Standortwechsel updaten.
  useEffect(() => {
    if (!mapRef.current) return;
    markerRef.current?.setLngLat([centerLon, centerLat]);
  }, [centerLon, centerLat]);

  // GeoJSON bei Forecast-Update aktualisieren.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("estofex") as maplibregl.GeoJSONSource | undefined;
      src?.setData(geojson);
    };
    if (map.loaded()) apply();
    else map.once("load", apply);
  }, [geojson]);

  return (
    <div
      ref={ref}
      className="h-[320px] w-full overflow-hidden rounded-md border border-border md:h-[420px]"
      aria-label="ESTOFEX Level-Polygone auf Europakarte"
    />
  );
}

/* -------------------- Legende -------------------- */

function Legend({ levels }: { levels: Array<1 | 2 | 3> }) {
  const uniq = Array.from(new Set(levels)).sort() as Array<1 | 2 | 3>;
  if (uniq.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      {uniq.map((l) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-[2px] border border-border/60"
            style={{ backgroundColor: LEVEL_FILL[l], opacity: 0.5 }}
            aria-hidden
          />
          Level {l}
        </span>
      ))}
    </div>
  );
}

/* -------------------- Text (Collapsible) -------------------- */

function ForecastText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-border bg-background/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-foreground/90"
        aria-expanded={open}
      >
        <span>Forecast-Text anzeigen</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border px-3 py-3 text-[12px] leading-relaxed text-foreground/90 whitespace-pre-line">
          {text}
        </div>
      )}
    </div>
  );
}

/* -------------------- Attribution (Pflicht) -------------------- */

function Footer() {
  return (
    <p className="text-[10px] text-muted-foreground">
      <a
        href="https://www.estofex.org"
        target="_blank"
        rel="noreferrer noopener"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Forecast provided by ESTOFEX
      </a>{" "}
      · CC BY-NC-SA 3.0 · Experimenteller Outlook eines Freiwilligenteams, kein amtlicher
      Warndienst.
    </p>
  );
}