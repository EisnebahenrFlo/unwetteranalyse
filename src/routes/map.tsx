import { createFileRoute } from "@tanstack/react-router";
import { RadarCockpit } from "@/components/radar/RadarCockpit";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Radar-Cockpit — ForecastHub" },
      {
        name: "description",
        content:
          "DWD RY/WN/PI mit Stormtracking aus dem DWD RY-Niederschlagskomposit (dBZ via Z-R abgeleitet), Hagelkern-Näherung und Kurzfrist-Nowcast.",
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