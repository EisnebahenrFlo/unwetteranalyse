# MeteoFlo Plan

Privates Wetteranalysetool für DACH und Italien, DWD-orientiert, mit Lernmodus. Alle 8 Module gehen direkt in den MVP, jedes mit Basisfunktionen, sauber erweiterbar.

## Produktstruktur

Mobile first, ruhige nordische Optik, Light als Default, Dark mitgepflegt. Kein Login, keine Cloud, alle Einstellungen lokal in `localStorage`. Keine reißerische Wetter-Sprache, klare DWD-Schwellenlogik.

## Seitenarchitektur (TanStack Router)

```text
src/routes/
  __root.tsx            App-Shell, Header, Bottom-Nav (mobil), Sidebar (desktop)
  index.tsx             Dashboard
  map.tsx               Kartenansicht (Radar, Niederschlag, Warnungen, Modelle)
  models.tsx            Modellvergleich
  alerts.tsx            Warnlagen (Bright Sky Alerts + eigene Schwellen)
  stations.tsx          Stationsdaten / Beobachtungen
  analysis.tsx          Interpretierte Wetterlage
  learn.tsx             Lernmodus (Glossar, Schwellen, Konzepte)
  settings.tsx          Einheiten, Orte, Layer, Farben, Theme
```

Aktiver Ort lebt als URL-Search-Param (`?lat=&lon=&name=`), damit jede Seite den gleichen Kontext zeigt und Links teilbar sind. Ortsliste in `localStorage`.

## Datenarchitektur

Drei saubere Layer, jeweils eigene Ordner:

```text
src/lib/
  weather/
    sources/
      open-meteo.ts        Forecast, Modelle, historisch, Luftqualität
      bright-sky.ts        DWD Beobachtungen, Radar, Alerts
    mappers/               Roh-JSON → typsichere DTOs (camelCase, SI-Einheiten)
    thresholds/            DWD-Schwellen für Wind, Regen, Schnee, Gewitter, Hitze, Frost
    analysis/              Ableitungen: Taupunkt-Spread, Schneefallgrenze, CAPE-Einordnung
    types.ts               Gemeinsame Domain-Typen
  geo/
    geocoding.ts           Open-Meteo Geocoding (DACH + IT Filter)
  storage/
    saved-locations.ts     localStorage CRUD
    settings.ts            Einheiten, Theme, Layer-Defaults
```

Jeder Datenblock im UI bekommt ein Mini-Meta-Objekt: `{ source, updatedAt, resolutionKm, uncertainty }`. Wird in einer kleinen `<DataMeta />` Komponente unten an jeder Karte angezeigt, damit Beobachtung, Nowcast und Modellprognose sichtbar getrennt sind.

Datenabruf via TanStack Query, Loader primt den Cache via `ensureQueryData`, Komponenten lesen via `useSuspenseQuery`. Keine API-Calls in Komponenten. Alle Quellen sind kostenlos und ohne Key, daher kein Backend nötig im MVP.

## Komponentenliste

```text
src/components/
  layout/
    AppShell.tsx           Header + Nav-Wechsel mobil/desktop
    LocationSwitcher.tsx   Aktiver Ort, Suche, gespeicherte Orte
    BottomNav.tsx, SideNav.tsx
  common/
    DataCard.tsx           Einheitlicher Rahmen für jede Analysekarte
    DataMeta.tsx           Quelle, Stand, Auflösung, Unsicherheit
    ValueWithUnit.tsx
    TrendSparkline.tsx
    WarnBadge.tsx          markant / Unwetter / extrem, DWD-Farblogik
    InfoPopover.tsx        Lern-Tooltip pro Parameter
    EmptyState.tsx, ErrorState.tsx, LoadingSkeleton.tsx
  dashboard/
    CurrentConditions.tsx
    NextChange.tsx         „Nächster relevanter Wetterumschwung“
    HourlyStrip.tsx
    DailyStrip.tsx
    AlertsSummary.tsx
  map/
    WeatherMap.tsx         MapLibre GL Wrapper
    LayerToggle.tsx        Radar, Niederschlag, Wind, Temp, Warnungen
    LegendBar.tsx
  models/
    ModelCompareChart.tsx  Mehrere Modelle in einem Diagramm
    ModelSpreadIndicator.tsx
  alerts/
    AlertList.tsx, AlertDetail.tsx, ThresholdExplain.tsx
  stations/
    StationList.tsx, StationDetail.tsx
  analysis/
    SoundingSummary.tsx    CAPE, LI, Nullgrad-/Schneefallgrenze
    ConvectionPanel.tsx
    WinterPanel.tsx
  learn/
    GlossaryList.tsx, ConceptCard.tsx, ThresholdTable.tsx
  settings/
    UnitSettings.tsx, LocationSettings.tsx, LayerSettings.tsx, ThemeToggle.tsx
```

Jede Analysekarte rendert via `DataCard` mit fester Struktur: Titel, Wert, Trend, `WarnBadge` falls relevant, `InfoPopover` mit Lern-Erklärung, `DataMeta` unten. Konsistenz schlägt Variation.

## UI-Konzept

- Light-Default, kühles Off-White, ein einzelner sachlicher Akzent (gedecktes Blau). Dark-Variante mit tiefem Anthrazit.
- Typografie: Inter für UI, JetBrains Mono für Werte/Zeiten.
- Layout: mobil eine Spalte, Desktop 12-Spalten-Grid mit max. 1440px.
- Warnfarben strikt nach DWD-Logik: gelb (markant), orange (Unwetter), rot (extremes Unwetter), violett (extrem). Nie für Dekoration verwenden.
- Above the fold im Dashboard: aktueller Zustand, aktive Warnung, nächste 6 Stunden, nächster Wetterumschwung.
- Animationen nur als kurze Opacity/Translate-Transitions, keine Spielereien.

## MVP-Umfang (Stufe 1)

Alle 8 Module live, jeweils Basisfunktion:

1. **Dashboard**: Current Conditions (Bright Sky nächste Station + Open-Meteo aktueller Punkt), Hourly 24h, Daily 7d, aktive Alerts, „Nächster Umschwung“ heuristisch aus Forecast.
2. **Karte**: MapLibre mit OSM-Basemap, Radar-Overlay (Bright Sky), Niederschlags- und Temperatur-Overlay (Open-Meteo Tiles), Warnpolygone, Layer-Toggle, Legende.
3. **Modellvergleich**: ICON-D2, ICON-EU, IFS, GFS, AROME als Linien für Temperatur, Niederschlag, Wind; Modell-Spread visualisiert.
4. **Warnlagen**: Bright Sky Alerts gelistet + eigene Schwellen-Auswertung mit Begründung in einfacher Sprache.
5. **Stationsdaten**: Liste DWD-Stationen im Umkreis, Detailansicht mit aktuellen Werten und letzten 24h.
6. **Analyse**: Taupunkt-Spread, Nullgrad-/Schneefallgrenze, CAPE, Lifted Index, Konvektionsbewertung in Worten.
7. **Lernmodus**: Glossar (Taupunkt, CAPE, LI, Bft, mm/h, Bewölkungsschichten), Schwellen-Tabelle, Konzeptkarten zu Beobachtung vs. Nowcast vs. Modell.
8. **Einstellungen**: Einheiten (°C, m/s vs. km/h, mm), Orte verwalten, Default-Layer, Theme.

Italien: Geocoding und Forecast über Open-Meteo funktionieren direkt. Bright Sky wird nur dort genutzt, wo Daten existieren (DACH); ansonsten klarer Fallback-Hinweis statt leerer Fläche.

## Ausbaustufen

- **Stufe 2**: Historischer Vergleich (Open-Meteo Archive), Favoriten-Layouts pro Ort, Export von Analysen als PDF, Push-fähige Warnschwellen-Logik im Browser.
- **Stufe 3**: Eigene Sounding-Ansicht (Open-Meteo Pressure Levels), Ensemble-Mitglieder, Vergleich mit MeteoSwiss/ZAMG offenen Daten, Italien-spezifische Quellen (ARPA-Feeds), optional Lovable Cloud für Sync und Verlauf.
- **Stufe 4**: Lernpfade im Lernmodus, eigene Notizen pro Wetterlage, Vergleich „Prognose vs. eingetroffen“.

## Technik (kurz)

- TanStack Start, TypeScript strict, Tailwind v4 mit Design-Tokens in `src/styles.css`, shadcn-Komponenten.
- TanStack Query für alle Wetterdaten, Loader primen Cache.
- MapLibre GL für Karten, kein Mapbox-Key nötig.
- Recharts für Modellvergleich und Zeitachsen.
- Lucide-Icons. Keine schweren Abhängigkeiten.
- Kein Backend, kein Login, keine Cookies. Alle Nutzerdaten in `localStorage`.

## Was ich beim Bauen explizit weglasse

- Kein Social, kein Sharing, keine Accounts.
- Keine dekorativen Animationen, keine Glassmorphism-Effekte.
- Keine Logik in UI-Komponenten, alle Ableitungen in `analysis/` bzw. `mappers/`.
- Keine kostenpflichtigen APIs, keine API-Keys im MVP.

Sag Bescheid, wenn ich loslegen soll, oder ob Du etwas am Zuschnitt drehen willst.