import { createFileRoute } from "@tanstack/react-router";
import { TemperatureMapCockpit } from "@/components/maps/TemperatureMapCockpit";

export const Route = createFileRoute("/forecast-maps")({
  head: () => ({
    meta: [
      { title: "Vorhersagekarten — ForecastHub" },
      {
        name: "description",
        content:
          "Live-Temperaturvorhersage als Flächenkarte (DACH + Italien), 24 h, Open-Meteo best_match.",
      },
    ],
  }),
  component: () => (
    <div className="flex flex-col">
      <TemperatureMapCockpit />
    </div>
  ),
});