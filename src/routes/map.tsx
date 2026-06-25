import { createFileRoute } from "@tanstack/react-router";
import { RadarCockpit } from "@/components/radar/RadarCockpit";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Radar-Cockpit — ForecastHub" },
      {
        name: "description",
        content:
          "DWD RY/WN/PI mit Stormtracking direkt aus der Radar-Reflektivität, Hagelkern-Erkennung und Kurzfrist-Nowcast.",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  return (
    <div className="flex flex-col">
      <RadarCockpit />
    </div>
  );
}