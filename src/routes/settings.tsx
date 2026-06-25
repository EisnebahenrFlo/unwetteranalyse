import { createFileRoute } from "@tanstack/react-router";
import { DataCard } from "@/components/common/DataCard";
import { useSettings } from "@/hooks/use-settings";
import { useSavedLocations } from "@/hooks/use-saved-locations";
import { removeSavedLocation } from "@/lib/storage/saved-locations";
import { Button } from "@/components/ui/button";
import { Trash2 } from "@/components/icons";
import type {
  ThemeMode,
  TempUnit,
  WindUnit,
  StormAlertLevel,
  HazardMinLevel,
} from "@/lib/storage/settings";
import { HazardHistoryList } from "@/components/hazards/HazardHistoryList";
import { clearHazardHistory } from "@/lib/weather/hazards/history";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Einstellungen — ForecastHub" },
      { name: "description", content: "Einheiten, Theme und gespeicherte Orte." },
    ],
  }),
  component: SettingsPage,
});

const TEMP_UNITS: { value: TempUnit; label: string }[] = [
  { value: "C", label: "°C" },
  { value: "F", label: "°F" },
];
const WIND_UNITS: { value: WindUnit; label: string }[] = [
  { value: "kmh", label: "km/h" },
  { value: "ms", label: "m/s" },
  { value: "bft", label: "Bft" },
];
const THEMES: { value: ThemeMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

const ETA_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
];
const ALERT_LEVELS: { value: StormAlertLevel; label: string }[] = [
  { value: "watch", label: "ab beobachten" },
  { value: "serious", label: "ab ernst" },
  { value: "severe", label: "nur schwer" },
];

const HAZARD_MIN_LEVELS: { value: HazardMinLevel; label: string }[] = [
  { value: "watch", label: "ab beobachten" },
  { value: "elevated", label: "ab erhöht" },
  { value: "high", label: "ab hoch" },
  { value: "extreme", label: "nur extrem" },
];

const HAZARD_RETENTION: { value: number; label: string }[] = [
  { value: 7, label: "7 Tage" },
  { value: 14, label: "14 Tage" },
  { value: 30, label: "30 Tage" },
];

function SettingsPage() {
  const [settings, setSettings] = useSettings();
  const saved = useSavedLocations();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-xs text-muted-foreground">
          Alles lokal in deinem Browser, kein Login, kein Sync.
        </p>
      </div>

      <DataCard title="Einheiten">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Group label="Temperatur">
            {TEMP_UNITS.map((u) => (
              <Choice
                key={u.value}
                active={settings.tempUnit === u.value}
                onClick={() => setSettings({ ...settings, tempUnit: u.value })}
              >
                {u.label}
              </Choice>
            ))}
          </Group>
          <Group label="Wind">
            {WIND_UNITS.map((u) => (
              <Choice
                key={u.value}
                active={settings.windUnit === u.value}
                onClick={() => setSettings({ ...settings, windUnit: u.value })}
              >
                {u.label}
              </Choice>
            ))}
          </Group>
          <Group label="Theme">
            {THEMES.map((t) => (
              <Choice
                key={t.value}
                active={settings.theme === t.value}
                onClick={() => setSettings({ ...settings, theme: t.value })}
              >
                {t.label}
              </Choice>
            ))}
          </Group>
        </div>
      </DataCard>

      <DataCard title="Gespeicherte Orte" subtitle={`${saved.length} Orte`}>
        <ul className="flex flex-col">
          {saved.map((l) => (
            <li
              key={l.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border/50 py-2 last:border-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{l.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {l.admin ? `${l.admin}, ` : ""}
                  {l.country} · {l.lat.toFixed(3)}, {l.lon.toFixed(3)}
                </div>
              </div>
              {!l.id.startsWith("default-") && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => removeSavedLocation(l.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </DataCard>

      <DataCard
        title="Stormtracking"
        subtitle="Detection direkt aus DWD-RY-Reflektivität, Forecast +60 min"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Group label="Status">
            <Choice
              active={settings.storm.enabled}
              onClick={() =>
                setSettings({
                  ...settings,
                  storm: { ...settings.storm, enabled: !settings.storm.enabled },
                })
              }
            >
              {settings.storm.enabled ? "Aktiv" : "Aus"}
            </Choice>
            <Choice
              active={settings.storm.showLayer}
              onClick={() =>
                setSettings({
                  ...settings,
                  storm: { ...settings.storm, showLayer: !settings.storm.showLayer },
                })
              }
            >
              Karten-Layer
            </Choice>
            <Choice
              active={settings.storm.showHailCores}
              onClick={() =>
                setSettings({
                  ...settings,
                  storm: { ...settings.storm, showHailCores: !settings.storm.showHailCores },
                })
              }
            >
              Hagelkerne
            </Choice>
          </Group>
          <Group label="Alert ETA-Schwelle">
            {ETA_OPTIONS.map((o) => (
              <Choice
                key={o.value}
                active={settings.storm.alertEtaMin === o.value}
                onClick={() =>
                  setSettings({ ...settings, storm: { ...settings.storm, alertEtaMin: o.value } })
                }
              >
                {o.label}
              </Choice>
            ))}
          </Group>
          <Group label="Alert-Severity">
            {ALERT_LEVELS.map((o) => (
              <Choice
                key={o.value}
                active={settings.storm.alertLevel === o.value}
                onClick={() =>
                  setSettings({ ...settings, storm: { ...settings.storm, alertLevel: o.value } })
                }
              >
                {o.label}
              </Choice>
            ))}
          </Group>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Quelle: DWD RADOLAN-RY (5-min, 1-km). Zell-Detektion über Reflektivitäts-Threshold und
          Connected-Component-Labeling, Tracking via Centroid-Matching zwischen aufeinanderfolgenden
          Frames. Alerts feuern, wenn der Forecast-Cone einen Favoriten innerhalb der ETA-Schwelle
          streift und die Severity passt. Cooldown 10 min pro Zelle und Favorit.
        </p>
      </DataCard>

      <DataCard title="Hazard-Engine" subtitle="Hagel und Sturzflut pro Storm-Zelle">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Group label="Status">
            <Choice
              active={settings.hazards.enabled}
              onClick={() =>
                setSettings({
                  ...settings,
                  hazards: { ...settings.hazards, enabled: !settings.hazards.enabled },
                })
              }
            >
              {settings.hazards.enabled ? "Aktiv" : "Aus"}
            </Choice>
          </Group>
          <Group label="Hazards">
            <Choice
              active={settings.hazards.enableHail}
              onClick={() =>
                setSettings({
                  ...settings,
                  hazards: { ...settings.hazards, enableHail: !settings.hazards.enableHail },
                })
              }
            >
              Hagel
            </Choice>
            <Choice
              active={settings.hazards.enableFlood}
              onClick={() =>
                setSettings({
                  ...settings,
                  hazards: { ...settings.hazards, enableFlood: !settings.hazards.enableFlood },
                })
              }
            >
              Sturzflut
            </Choice>
          </Group>
          <Group label="Mindeststufe für Alerts">
            {HAZARD_MIN_LEVELS.map((o) => (
              <Choice
                key={o.value}
                active={settings.hazards.minLevel === o.value}
                onClick={() =>
                  setSettings({ ...settings, hazards: { ...settings.hazards, minLevel: o.value } })
                }
              >
                {o.label}
              </Choice>
            ))}
          </Group>
          <Group label="ETA-Schwelle">
            {ETA_OPTIONS.map((o) => (
              <Choice
                key={o.value}
                active={settings.hazards.alertEtaMin === o.value}
                onClick={() =>
                  setSettings({
                    ...settings,
                    hazards: { ...settings.hazards, alertEtaMin: o.value },
                  })
                }
              >
                {o.label}
              </Choice>
            ))}
          </Group>
          <Group label="Verlauf">
            {HAZARD_RETENTION.map((o) => (
              <Choice
                key={o.value}
                active={settings.hazards.retentionDays === o.value}
                onClick={() =>
                  setSettings({
                    ...settings,
                    hazards: { ...settings.hazards, retentionDays: o.value },
                  })
                }
              >
                {o.label}
              </Choice>
            ))}
            <Button size="sm" variant="ghost" onClick={() => clearHazardHistory()}>
              Verlauf leeren
            </Button>
          </Group>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Hagel-POH/MESHS aus Radar-Top-dBZ + Hagelkern-Fläche, gestützt durch CAPE, Lifted Index
          und Freezing Level (Open-Meteo). Sturzflut aus Open-Meteo-Niederschlag (1 h / 3 h / 6 h /
          24 h) gegen KOSTRA-DWD-Schwellen.
        </p>
      </DataCard>

      {saved.length > 0 && (
        <DataCard
          title="Hazard-Verlauf"
          subtitle={`Letzte ${settings.hazards.retentionDays} Tage pro Favorit`}
        >
          <div className="flex flex-col gap-4">
            {saved.map((l) => (
              <div key={l.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-medium">{l.name}</div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {l.lat.toFixed(2)}, {l.lon.toFixed(2)}
                  </span>
                </div>
                <HazardHistoryList
                  favoriteId={l.id}
                  days={settings.hazards.retentionDays}
                  emptyHint="Bisher keine Hazard-Events erfasst."
                />
              </div>
            ))}
          </div>
        </DataCard>
      )}

      <DataCard title="Datenquellen">
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>
            <strong className="text-foreground">Open-Meteo</strong> · Forecast, Modellvergleich,
            abgeleitete Werte.
          </li>
          <li>
            <strong className="text-foreground">Bright Sky / DWD Open Data</strong> ·
            Stationsbeobachtungen und offizielle Warnungen für DACH.
          </li>
          <li>
            <strong className="text-foreground">DWD Radar (WMS)</strong> · RY-Reflektivität als
            Basis für Karten-Layer und Stormtracking.
          </li>
          <li>
            <strong className="text-foreground">OpenStreetMap</strong> · Karten-Basislayer.
          </li>
        </ul>
      </DataCard>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} onClick={onClick}>
      {children}
    </Button>
  );
}