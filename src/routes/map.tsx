import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { WeatherMap } from "@/components/map/WeatherMap";
import { useActivePoint } from "@/components/layout/LocationSwitcher";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Karte — MeteoFlo" },
      { name: "description", content: "Radar, Niederschlag und Warnungen auf der Karte für DACH und Italien." },
    ],
  }),
  component: MapPage,
});

type Layer = "radar" | "none";

function MapPage() {
  const point = useActivePoint();
  const [layer, setLayer] = useState<Layer>("radar");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">Karte</h1>
          <p className="truncate text-xs text-muted-foreground">Live-Radar (RainViewer, nahezu global) auf OSM-Basemap.</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant={layer === "radar" ? "default" : "outline"} onClick={() => setLayer("radar")}>Radar</Button>
          <Button size="sm" variant={layer === "none" ? "default" : "outline"} onClick={() => setLayer("none")}>Aus</Button>
        </div>
      </div>
      <WeatherMap center={point} layer={layer} />
      <p className="text-[11px] text-muted-foreground">
        Niederschlags- und Modell-Overlays werden in Stufe 2 ergänzt. DWD-Warnpolygone benötigen die separate DWD CAP-Schnittstelle und folgen.
      </p>
    </div>
  );
}
