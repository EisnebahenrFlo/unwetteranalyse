import { createFileRoute } from "@tanstack/react-router";
import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { ALL_RULES, severityWeight } from "@/lib/weather/thresholds/dwd";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "Lernmodus — MeteoFlo" },
      { name: "description", content: "Begriffe, Schwellen und Konzepte verständlich erklärt." },
    ],
  }),
  component: LearnPage,
});

const GLOSSARY = [
  { term: "Taupunkt", text: "Temperatur, bei der die Luft mit Wasserdampf gesättigt ist. Kleiner Abstand zur Lufttemperatur bedeutet hohe Sättigung." },
  { term: "CAPE", text: "Convective Available Potential Energy in J/kg. Misst, wie viel Energie ein aufsteigendes Luftpaket gewinnt. Hohe Werte begünstigen kräftige Gewitter." },
  { term: "Lifted Index", text: "Differenz aus Umgebungstemperatur und Temperatur eines auf 500 hPa gehobenen Luftpakets. Negative Werte = labile Schichtung." },
  { term: "Nullgradgrenze", text: "Höhe in Metern über NN, in der die Temperatur 0 °C erreicht. Wichtig für die Schneefallgrenze." },
  { term: "Beaufort (Bft)", text: "Skala für Windstärke. Bft 7 ≈ 50 km/h (steifer Wind), Bft 10 ≈ 90 km/h (schwerer Sturm), Bft 12 ≥ 118 km/h (Orkan)." },
  { term: "Bewölkungsschichten", text: "Tiefe (bis 2 km), mittlere (2–7 km) und hohe Wolken (> 7 km). Open-Meteo liefert die Gesamtbedeckung in %." },
  { term: "Modell-Spread", text: "Streuung der Vorhersagen verschiedener Wettermodelle. Großer Spread = höhere Unsicherheit." },
];

const CONCEPTS = [
  {
    title: "Beobachtung vs. Nowcast vs. Modell",
    text: "Beobachtungen kommen von Stationen und Radar und zeigen den Ist-Zustand. Nowcasts extrapolieren die nächsten 0–2 Stunden direkt aus dem Radar. Modellprognosen rechnen die Physik der Atmosphäre stunden- bis tageweit voraus.",
  },
  {
    title: "Warum DWD-Schwellen?",
    text: "Der DWD nutzt klare Stufen (markant, Unwetter, schweres Unwetter, extrem). MeteoFlo orientiert sich daran, damit Einordnungen vergleichbar bleiben.",
  },
  {
    title: "Wie verlässlich ist ein Wert?",
    text: "Jede Karte zeigt Quelle, Stand und Auflösung. Je gröber das Modell, desto weniger lokale Details. Stationsdaten sind punktgenau, decken aber nicht jeden Ort ab.",
  },
];

export function LearnPage() {
  const sorted = [...ALL_RULES].sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity));
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Lernmodus</h1>
        <p className="text-xs text-muted-foreground">Begriffe und Schwellen für die eigene Einordnung.</p>
      </div>

      <DataCard title="Glossar">
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="rounded-md border border-border bg-background/50 p-3">
              <dt className="text-sm font-semibold text-foreground">{g.term}</dt>
              <dd className="mt-1 text-xs text-muted-foreground">{g.text}</dd>
            </div>
          ))}
        </dl>
      </DataCard>

      <DataCard title="Konzepte">
        <div className="flex flex-col gap-3">
          {CONCEPTS.map((c) => (
            <article key={c.title} className="rounded-md border border-border bg-background/50 p-3">
              <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{c.text}</p>
            </article>
          ))}
        </div>
      </DataCard>

      <DataCard title="DWD-orientierte Schwellen">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3">Stufe</th>
                <th className="py-1.5 pr-3">Parameter</th>
                <th className="py-1.5 pr-3">Schwelle</th>
                <th className="py-1.5 pr-3">Bedeutung</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-t border-border/50 align-top">
                  <td className="py-2 pr-3"><WarnBadge severity={r.severity} /></td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.parameter}</td>
                  <td className="py-2 pr-3 font-medium">{r.label}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{r.explain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
