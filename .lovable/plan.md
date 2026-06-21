## Ziel

Die App bekommt eine saubere, mehrstufige Scoring-Architektur und eine neu gegliederte Analyse-Seite. Jeder Score ist nachvollziehbar: Rohdaten → abgeleitete Parameter → Teilrisiken (0–100) → Gesamtscore (gewichtet je Zeitfenster) → Vertrauen → verbales Label. Keine Blackbox.

## 1. Neue Scoring-Architektur (`src/lib/weather/scoring/`)

Komplett neu, klar getrennt von der alten `convection.ts`/`hazards.ts`-Logik (die bleibt als Helfer bestehen, wird aber von der neuen Schicht orchestriert).

### Dateien
- `scoring/labels.ts` — zentrale Schwellen + Labels (`ruhig` 0–14, `aufmerksam` 15–34, `markant` 35–59, `kritisch` 60–79, `hochkritisch` 80–100), App-weit verwendet.
- `scoring/normalize.ts` — Normalisierung roher Werte auf 0–100 (CAPE, LI, K, TT, Niederschlag, Böen, Blitzaktivität, Radarintensität).
- `scoring/subscores.ts` — fünf Teilscores 0–100, jeder mit `value`, `contributors[]`, `confidence`:
  - `rainScore`
  - `windScore`
  - `thunderScore`
  - `convectionScore` (CAPE, LI, K, TT, CIN)
  - `dataConfidence`
- `scoring/derived.ts` — abgeleitete Kennwerte: K-Index (`(T850-T500)+Td850-(T700-Td700)`), Total Totals (`T850+Td850-2·T500`), Schwüle, Spread, Low-Level-Shear. Für Open-Meteo nutzen wir die geopotenziellen Levels (`temperature_850hPa`, `dew_point_850hPa`, `temperature_700hPa`, `dew_point_700hPa`, `temperature_500hPa`) — diese Variablen werden zur API-Abfrage hinzugefügt.
- `scoring/nowcast.ts` — Score für 0–2 h auf 10-min Raster. Gewichtung: Radar/Blitz/Niederschlag/Böen/Live-Signale hoch, Konvektion mittel. Nutzt `minutely_15` + interpolierte Stunden + (falls verfügbar) Blitz-Live-Buffer aus `useLightningStream`.
- `scoring/today.ts` — Score für 0–24 h auf Stundenbasis. Gewichtung: CAPE, LI, Gewitterwahrscheinlichkeit, Niederschlag, Böen, K/TT.
- `scoring/explain.ts` — strukturierte Erklärung: pro Score Liste der Beitragenden mit Wert + Punktbeitrag, plus Confidence-Faktoren.

### Datenmodelle
```ts
type Band = "ruhig" | "aufmerksam" | "markant" | "kritisch" | "hochkritisch";

interface Subscore {
  value: number;            // 0–100
  band: Band;
  contributors: { label: string; raw: string; points: number }[];
  confidence: number;       // 0–100
}

interface CompositeScore {
  total: number;            // 0–100
  band: Band;
  peakAt?: string;          // ISO
  subs: { rain: Subscore; wind: Subscore; thunder: Subscore; convection: Subscore };
  data: Subscore;           // Datenvertrauen
  reasons: string[];        // kurze Klartextzeilen
}
```

### Confidence-Berechnung
Basiert auf: Datenabdeckung (welche Felder vorhanden), Aktualität (Alter der Beobachtung), Konsistenz Modell↔Beobachtung (Live vs. interpolierte Stunde), Radar-Frame-Frische (aus `dwd-wms`), Blitz-Stream-Status, Plausibilität (z. B. CAPE>2000 ohne Niederschlagssignal → Abzug).

## 2. Neue Analyse-Seite (`src/routes/analysis.tsx`)

Drei Tabs bleiben (`Nowcast 0–2 h`, `Heute 0–24 h`, `Parameter`), Inhalte neu:

### Tab „Nowcast 0–2 h"
Reihenfolge:
1. **Hauptblock** `NowcastHeadline` — großer Score, Band-Label, Peak-Zeitpunkt (+min), Confidence-Balken, eine Klartextzeile.
2. **Teilrisiken** `SubscoreBars` — vier horizontale Balken (Regen, Wind, Gewitter, Konvektion) mit Wert + Top-3-Beitragenden als kleinen Text.
3. **Zeitachse** `NowcastTable` — pro 10-min Schritt: Zeit, Wetter-Icon, Gewittersignal (⚡/–), Regen (mm/h + Balken), Wind (km/h + Bö), Score-Pille, Confidence-Punkt, Radar/Blitz-Bestätigung.
4. **Erklärung** `ScoreExplainPanel` — ausklappbar, listet alle Beiträge mit Punkten.
5. **Datenstatus** `DataStatusStrip` — Quellen + Frische (Open-Meteo, Bright Sky, DWD Radar, Blitz).

### Tab „Heute 0–24 h"
1. `TodayHeadline` — Tagesscore + Band + Peak-Fenster (Stundenbereich, nicht Punkt).
2. `SubscoreBars` für die Tageslogik (andere Gewichtung).
3. `SevereTimeline` (vorhanden, leicht erweitert um Band-Farben).
4. `ScoreExplainPanel`.
5. `DataStatusStrip`.

### Tab „Parameter"
Karten-Grid, jeweils mit Rohwert + abgeleitetem Wert + Interpretationstext:
- Temperatur / Taupunkt / Spread / Schwüle
- Wind / Böen / Low-Level-Shear
- Niederschlag / Wahrscheinlichkeit
- Druck / Druck-Tendenz
- CAPE / Lifted Index / CIN
- K-Index (mit Schwellen ≥20 möglich, ≥30 wahrscheinlich, ≥40 sehr wahrscheinlich)
- Total Totals (≥44 möglich, ≥50 wahrscheinlich, ≥55 schwer)
- Gewitterwahrscheinlichkeit (Modell + heuristisch nebeneinander)

## 3. Datenquellen-Erweiterung

- `sources/open-meteo.ts` — `HOURLY_VARS` um `temperature_850hPa`, `temperature_700hPa`, `temperature_500hPa`, `dew_point_850hPa`, `dew_point_700hPa` ergänzen.
- `types.ts` — `HourlyPoint` um diese Felder erweitern.
- `mappers/open-meteo.ts` — neue Felder mappen.
- Blitz-Daten: bestehender `useLightningStream` wird optional in `nowcast.ts` injiziert (über Hook-Wrapper-Komponente).

## 4. App-weite Vereinheitlichung

- `severeScore` in `convection.ts` bleibt für Rückwärtskompatibilität (Dashboard, Karte), bekommt aber intern eine Brücke auf das neue Banding (`labels.ts`).
- `WarnBadge` bekommt eine Variante `band` zusätzlich zu `severity`, damit die neuen 5-stufigen Labels überall konsistent angezeigt werden können.
- Bestehende Cockpit-Komponenten auf der Startseite werden nicht angefasst, nur Analyse + Scoring.

## 5. Was bewusst NICHT geändert wird

- Radar-Cockpit (`/map`), Stationen, Modelle, Settings, Lernen.
- Dashboard-Layout (`/`) — nur falls `severeScore` sich verhält, sonst Brücke.
- Bright-Sky / DWD-Quellen bleiben unverändert (Beobachtungen werden bereits über `live.ts` ins Nowcast eingespeist).

## Reihenfolge der Umsetzung

1. Typen + Open-Meteo-Felder erweitern.
2. `scoring/`-Modul komplett anlegen (labels, normalize, derived, subscores, nowcast, today, explain).
3. Analyse-Komponenten neu: `NowcastHeadline`, `TodayHeadline`, `SubscoreBars`, `NowcastTable` (ersetzt `NowcastDecisionCard`-Inhalt), `ScoreExplainPanel`, `DataStatusStrip`, `ParamCardPro`.
4. `analysis.tsx` neu zusammenbauen.
5. `severeScore`-Brücke prüfen, damit das Dashboard stabil bleibt.

## Aufwand / Risiken

- 850/700/500 hPa-Levels von Open-Meteo sind nicht für jedes Modell verfügbar — wir fallen sauber auf `K = null`/`TT = null` zurück und ziehen das Datenvertrauen entsprechend.
- Blitz-Live ist nur im Browser verfügbar (WebSocket) — auf SSR/Initial-Render rechnet der Nowcast ohne Blitz, was korrekt im Confidence-Score abgebildet wird.
- Keine Migrationen, keine Auth-Änderungen.
