import { createFileRoute } from "@tanstack/react-router";
import { RadarCockpit } from "@/components/radar/RadarCockpit";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Radar-Cockpit — ForecastHub" },
      { name: "description", content: "DWD RY/WN/PI, Blitzortung live, Datenvertrauen und Kurzfrist-Nowcast in einer Karte." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">Radar-Cockpit</h1>
          <p className="truncate text-xs text-muted-foreground">DWD RY · WN-Nowcast · PI Mitteleuropa · Blitzortung live.</p>
        </div>
      </header>
      <RadarCockpit />
    </div>
  );
}
