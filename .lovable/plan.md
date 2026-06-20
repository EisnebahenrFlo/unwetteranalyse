## Ziel

App mobiltauglich machen, Doppelanzeigen entfernen, alle Visualisierungen auf Premium-Niveau heben und die Gewitter-/Unwettererkennung deutlich verbreitern — ohne Grundstruktur oder bestehende Funktionen zu brechen.

## 1. Navigation & Mobile

- `AppShell`: Seitenleiste auf **6 Top-Tabs** verschlanken durch logische Gruppierung. Sub-Tabs innerhalb der Routen, keine neuen Routen.
  - **Dashboard** (`/`)
  - **Wetter** (`/forecast` als Alias für `/`) — entfällt; siehe unten
  - **Radar & Karte** (`/map`)
  - **Analyse** (`/analysis`) — mit Sub-Tabs: *Nowcast 0–2h*, *Kurzfrist 0–6h*, *24h Ausblick*, *Modelle*, *Stationen*
  - **Warnungen** (`/alerts`)
  - **Lernen** (`/learn`)
  - **Einstellungen** (`/settings`)
  - `Modelle` und `Stationen` ziehen als Sub-Tabs in Analyse ein, behalten aber ihre Routen (Redirect/Verlinkung bleibt erhalten — Grundstruktur unverändert).
- **Mobile**: BottomNav wird zu **5 Tabs** (Dashboard / Karte / Analyse / Warnungen / Mehr). „Mehr" öffnet ein Sheet mit den restlichen Punkten.
- Header: Logo wird auf Mobile zum reinen Icon, Location-Switcher bekommt volle Breite, Theme-Toggle als Icon-Button.
- Touch-Targets ≥ 44 px, horizontale Scrollstreifen (Hourly/Daily/Nowcast) mit Snap-Scroll + Edge-Fades.

## 2. Doppelanzeigen entfernen / Konsolidierung Dashboard

Heute zeigt das Dashboard **vier ähnliche Severe-Karten**: `NowcastPanel`, `SevereOverview`, `SevereWeatherPanel`, plus Teile in `AlertsSummary`. Konsolidierung:

- **Neu: `ThreatBoard`** — eine intelligente Karte mit Sub-Tabs:
  - *Jetzt* (Live-Stufe, aktive Warnungen, Kurzdiagnose)
  - *Nowcast 0–2 h* (10-min-Raster, Regen/Hagel/Blitz)
  - *Heute 0–24 h* (Peaks, Zeitfenster, Hauptrisiko)
- Ersetzt `NowcastPanel` + `SevereOverview` + `SevereWeatherPanel` auf dem Dashboard. Die Komponenten bleiben als Bausteine bestehen, werden nur nicht mehr dreifach gerendert.
- `AlertsSummary` zeigt nur noch offizielle + abgeleitete Warnungen kompakt (Chips), Details im Tab Warnungen.

## 3. Premium UI/UX

Globale Designsprache (in `src/styles.css`, keine Tokens hardcoden):

- Karten: weiche Layer (`bg-card/80` + `backdrop-blur` + dezenter Innenschein per `shadow-elegant`-Token).
- Severity-Farbskala über semantische Tokens `--warn-info / minor / moderate / severe / extreme` plus passende `--warn-*-glow` Varianten für Verlauf.
- Premium-Charts:
  - Nowcast-Heatmap: SVG-Streifen mit Verlauf + Mikro-Sparklines für Regenrate, Blitz-Wahrscheinlichkeit, Hagelrisiko.
  - Severe-Timeline (24 h): mehrlagige Heatmap (Wind / Regen / CAPE / Blitz / Hagel) mit Hover-Tooltips.
  - Daily-Strip-Pillen: Verlaufshintergrund nach Schwere, Mini-Icons für dominantes Risiko.
- Typografie: Display-Font für Werte (z. B. Inter Tight / „Geist"), tabular-nums überall wo Zahlen tickern.
- Bewegung: dezente `framer-motion`-Übergänge für Sub-Tab-Wechsel (nur falls Paket schon da; sonst CSS-Transitions).
- Konsequenter Einsatz von `DataCard` mit neuem `tone`-Prop (default / accent / severe).

## 4. Gewitter-Peak überarbeiten

`SevereWeatherPanel` & neuer Threat-Tab „Heute":

- Klare **Peak-Karte**: Zeitfenster („17–20 Uhr"), Spitzenwerte (CAPE, LI, Böen, Regenrate, Blitzdichte), Konfidenz-Badge (1–5) basierend auf Modell-Konsens.
- Erklärtext in Klartext: was bedeutet der Peak, was ist zu erwarten.
- Mini-Multimetric-Chart über das Peak-Fenster (CAPE, Shear, Regen, Blitz).

## 5. Mehr Warntypen

Erweiterung in `src/lib/weather/thresholds/dwd.ts` + neue Auswertung in `situation.ts`. Hitze wird klar von „Unwetter" getrennt (eigene Kategorie `heat`, nicht `severe`):

- **Gewitter-Klassen**: Einzelzelle / Mehrzellig / Superzelle (Heuristik aus CAPE × Shear × Helizität).
- **Hagel**: Wahrscheinlichkeit + Korngröße (CAPE × LI × Freezing-Level × Updraft-Proxy).
- **Starkregen / Dauerregen** (≥6h Akkumulation, getrennt von kurzem Starkregen).
- **Sturm / Orkan / Downburst-Risiko** (Böen + DCAPE + Lapse Rate).
- **Tornadorisiko** (SRH, Shear, LCL — Klartextlevel niedrig/mäßig/erhöht).
- **Glatteis / gefrierender Regen / Schneeglätte** (Niederschlag bei T<0).
- **Schneefall / Schneeverwehung** (Schneefall + Wind).
- **Nebel / Sichtweite < 200 m** (visibility aus Open-Meteo).
- **UV-Belastung** (UV-Index als Hinweis, keine Unwetter-Schwere).
- **Hitze / Tropennacht / Hitzewelle** als eigene Kategorie `heat` mit eigenem Farbschema (orange/rot, nicht Unwetter-Lila).
- **Luftqualität / Pollen** (Open-Meteo Air-Quality API) — optional als „Hinweis"-Tag.

Jede Warnung trägt: Kategorie, Schwere, Konfidenz, Zeitfenster, Begründung in Klartext.

## 6. Mehr Daten für Erkennung

Erweiterung `open-meteo.ts` (Hourly + Minutely_15):

- Zusätzliche Convective-Felder: `convective_inhibition`, `lifted_index`, `cape`, `boundary_layer_height`, `wind_shear` (aus 10 m vs 500 m), `helicity_3000m` (Proxy aus Wind-Profilen), `vertical_velocity_*hPa`.
- Modelle: ICON-D2 (1 km, 0–48 h) hinzufügen für Nowcast-Stütze; Konsens über ICON-D2 / ICON-EU / ECMWF / AROME / HARMONIE → Konfidenz.
- Open-Meteo **Air-Quality API** (PM2.5, PM10, NO2, O3, UV, Pollen).
- Open-Meteo **Flood API** (optional, für Starkregen-Kontext) — nur wenn ohne Schlüssel verfügbar.
- DWD-Blitzdichte via Open-Meteo `lightning_potential` falls vorhanden, sonst Heuristik aus CAPE×LI×PrecipRate.

Alles per `useQuery` mit `refetchInterval` (5–10 min) — Live-Verhalten bleibt erhalten.

## Technisches

- Neue Dateien:
  - `src/components/dashboard/ThreatBoard.tsx`
  - `src/components/common/SegmentedTabs.tsx` (Sub-Tab-Komponente, Touch-optimiert)
  - `src/components/layout/MoreMenu.tsx` (Mobile-Sheet)
  - `src/components/charts/SeverityHeatmap.tsx` (mehrlagige Heatmap)
  - `src/lib/weather/sources/open-meteo-air.ts` (Air-Quality)
  - `src/lib/weather/analysis/hazards.ts` (neue Warntypen)
  - `src/lib/weather/analysis/peak.ts` (Peak-Fenster-Logik)
- Geänderte Dateien (nicht-strukturell):
  - `AppShell.tsx` (Nav-Reduktion + MoreMenu)
  - `routes/index.tsx` (ThreatBoard statt 3 Karten)
  - `routes/analysis.tsx` (SegmentedTabs für Sub-Bereiche; Modelle/Stationen als Sub-Inhalte einbinden)
  - `thresholds/dwd.ts`, `situation.ts` (mehr Regeln + Kategorien)
  - `types.ts` (neue Felder, neue Kategorien)
  - `styles.css` (Warn-Token, Glows)
- **Nicht angefasst**: Router-Setup, bestehende Query-Keys / Quellen-APIs (nur Felder erweitert), Storage-Schema, Routen-Pfade.

## Out of scope

- Keine Auth, kein Backend, keine neuen Routen, keine Änderung am Geocoding oder LocationSwitcher-API.
- Bestehende Komponenten werden nicht gelöscht (nur Verwendung reduziert), damit der Analyse-Tab sie weiterverwenden kann.
