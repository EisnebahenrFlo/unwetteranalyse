import { createFileRoute } from "@tanstack/react-router";
import { DataCard } from "@/components/common/DataCard";
import { useSettings } from "@/hooks/use-settings";
import { useSavedLocations } from "@/hooks/use-saved-locations";
import { removeSavedLocation } from "@/lib/storage/saved-locations";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { ThemeMode, TempUnit, WindUnit } from "@/lib/storage/settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Einstellungen — MeteoFlo" },
      { name: "description", content: "Einheiten, Theme und gespeicherte Orte." },
    ],
  }),
  component: SettingsPage,
});

const TEMP_UNITS: { value: TempUnit; label: string }[] = [
  { value: "C", label: "°C" }, { value: "F", label: "°F" },
];
const WIND_UNITS: { value: WindUnit; label: string }[] = [
  { value: "kmh", label: "km/h" }, { value: "ms", label: "m/s" }, { value: "bft", label: "Bft" },
];
const THEMES: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Hell" }, { value: "dark", label: "Dunkel" }, { value: "system", label: "System" },
];

function SettingsPage() {
  const [settings, setSettings] = useSettings();
  const saved = useSavedLocations();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-xs text-muted-foreground">Alles lokal in deinem Browser, kein Login, kein Sync.</p>
      </div>

      <DataCard title="Einheiten">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Group label="Temperatur">
            {TEMP_UNITS.map((u) => (
              <Choice key={u.value} active={settings.tempUnit === u.value}
                onClick={() => setSettings({ ...settings, tempUnit: u.value })}>{u.label}</Choice>
            ))}
          </Group>
          <Group label="Wind">
            {WIND_UNITS.map((u) => (
              <Choice key={u.value} active={settings.windUnit === u.value}
                onClick={() => setSettings({ ...settings, windUnit: u.value })}>{u.label}</Choice>
            ))}
          </Group>
          <Group label="Theme">
            {THEMES.map((t) => (
              <Choice key={t.value} active={settings.theme === t.value}
                onClick={() => setSettings({ ...settings, theme: t.value })}>{t.label}</Choice>
            ))}
          </Group>
        </div>
      </DataCard>

      <DataCard title="Gespeicherte Orte" subtitle={`${saved.length} Orte`}>
        <ul className="flex flex-col">
          {saved.map((l) => (
            <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border/50 py-2 last:border-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{l.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {l.admin ? `${l.admin}, ` : ""}{l.country} · {l.lat.toFixed(3)}, {l.lon.toFixed(3)}
                </div>
              </div>
              {!l.id.startsWith("default-") && (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeSavedLocation(l.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">Standard-Orte (Berlin, Wien, Zürich, Bozen) lassen sich nicht löschen, neue über den Ortswechsler oben hinzufügen.</p>
      </DataCard>

      <DataCard title="Datenquellen">
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li><strong className="text-foreground">Open-Meteo</strong> · Forecast, Modellvergleich, abgeleitete Werte. Kostenlos, ohne Key, freie nicht-kommerzielle Nutzung.</li>
          <li><strong className="text-foreground">Bright Sky / DWD Open Data</strong> · Stationsbeobachtungen und offizielle Warnungen für DACH.</li>
          <li><strong className="text-foreground">DWD Radar</strong> · Niederschlagsradar als WMS-Layer für Deutschland und angrenzende Bereiche.</li>
          <li><strong className="text-foreground">OpenStreetMap</strong> · Karten-Basislayer.</li>
        </ul>
      </DataCard>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} onClick={onClick}>{children}</Button>
  );
}
