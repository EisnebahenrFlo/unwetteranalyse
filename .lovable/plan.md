## Ziel

Zwei Baustellen sauber lösen:
1. **Aktuelle Lage** im Dashboard auf Tabs/Sektionen umbauen, damit Werte wirklich erfassbar werden.
2. **Stormtracking auf der Radarkarte** mit klaren Labels und sauberer Zugbahn-Darstellung.

---

## 1. Aktuelle Lage neu (`CurrentConditions.tsx`)

Heute quetscht alles in eine Zeile mit Icon + Temp + 3 Mini-Felder. Wir trennen Themen.

**Aufbau:**
- Header bleibt: Titel „Aktuelle Lage" + Wettercode-Subtitle + Meta (Quelle, Stand).
- Darunter ein **Hero-Block** (immer sichtbar): großes Meteocon + Temperatur + gefühlt + Code-Label.
- Darunter `SegmentedTabs` mit 4 Sektionen:
  - **Temperatur** — aktuell, gefühlt, Taupunkt, rel. Feuchte, Schwülegrad-Hinweis falls Taupunkt ≥ 16 °C.
  - **Wind** — Mittelwind (Wert + Einheit + Kompass-Badge), Böen, Richtung als kleine Windrose (SVG-Pfeil), DWD-Schwellen-Hinweis.
  - **Niederschlag** — 10-min-Summe, Stunden-Tendenz aus `hourly`, Schauer/Gewitter-Wahrscheinlichkeit falls verfügbar.
  - **Druck & Sicht** — Druck + Tendenz (Δ aus letzten 3 h), Sichtweite, Bewölkung.
- Jede Sektion: `grid-cols-2 md:grid-cols-3`, Werte über `ValueWithUnit` size="lg", Hint klein darunter.
- State merken pro Session via `useState`, default „Temperatur".
- Leere Felder mit „—" statt Sektion auszublenden, damit Layout stabil bleibt.

**Mobile:** Tabs horizontal scrollbar, Hero stapelt über Tabs.

---

## 2. Stormtracking auf der Radarkarte

### 2a. Zell-Labels (`RadarMap.tsx` → `setStormCells`)

Aktuell zeigt das Label nur `id` + Motion. Neuer Label-Inhalt pro Zelle:

```text
C-204 · SCHWER
~38 dBZ · Top 9 km
38 km/h → NO
ETA Ansbach: 24 min
```

Umsetzung:
- Mehrzeiliges `text-field` über MapLibre-Expression (`["format", ...]`) mit unterschiedlichen `text-size` und Farben pro Zeile.
- Severity-Wort + Farbe aus `SEVERITY_COLOR` und Severity-Label-Tokens.
- **dBZ-Proxy:** aus `strikeRatePerMin` und `radiusKm` ableiten (Mapping in `severity.ts`, klar dokumentiert als Schätzwert). Echotop-Proxy ebenso aus CAPE/Severity → in `StormCell` zwei neue optionale Felder `estReflectivityDbz`, `estEchoTopKm`.
- **ETA nächster Ort:** kleine Helper-Funktion `nearestNamedPlace(cell, favorites, activeLocation)` — nimmt die nächste Favoriten- oder Aktiv-Location innerhalb des Cones, berechnet Distanz/Motion → Minuten. Liegt keine Location im Cone, Zeile weglassen.
- Label-Anker `top-left` mit `text-offset [0.8, 0.4]` und `text-justify: left`, damit der Block neben dem Centroid hängt und nicht überlappt.
- Bei Zoom < 7 nur Zeile 1 (`id + severity`) anzeigen, alles weitere über `text-size`-Stops und `symbol-sort-key` auf Severity-Rank (severe zuerst).

### 2b. Zugbahn (gemäß Auswahl: Linie + Cone + ETA-Punkte)

Heute schon vorhanden, aber visuell laut. Wir räumen auf:

- **Vergangene Zugbahn** (`storm-past-line`/`-pts`):
  - Linie: dezent in Zellfarbe, `line-width: 2`, `line-opacity: 0.55`, weißer 0.5 px Halo via zweite Linie darunter.
  - Punkte nur jeden 2. Eintrag, älteste mit alpha 0.2, Größe 2.5.
- **Forecast-Linie** (`storm-fc-line`): durchgehend kräftig in Severity-Farbe, `line-width: 3`, `line-dasharray: [2, 1.5]`.
- **Cone** (`storm-cone`): Fill auf `0.10`, Outline gleiche Severity-Farbe `0.6` Opacity. Wenn Cone > sehr groß (Sigma hoch) auf max ~80 km abschneiden, damit nicht halb Bayern eingefärbt wird.
- **ETA-Marker** (`storm-eta-pts`/`-labels`): nur +15 / +30 / +60. Label klar `+15 min`, weißer Halo 1.6, kleine Outline-Pille (Background-Rect über `text-padding` simulieren).
- **Pfeilspitze** (`storm-fc-arrow`): bleibt, aber Größe an Zoom koppeln (`interpolate` zoom 6 → 12, 16 → 22) und Anker leicht zurücksetzen, damit Spitze auf dem Endpunkt sitzt.
- **Layer-Reihenfolge fest:** past unten → cone → forecast → arrow → ETA-Punkte → Labels oben. `firstOverlayLayer` Liste entsprechend justieren.

### 2c. Severity-Tokens & Helper

- In `severity-tokens.ts` Severity-Label-Strings (`CALM / BEOBACHTEN / MARKANT / UNWETTER`) zentral halten.
- In `storm/severity.ts` Helper `estimateReflectivity(cell)` und `estimateEchoTop(cell, env)` ergänzen, mit Kommentaren zur Herleitung und klarer Kennzeichnung „Schätzwert".
- In `storm/forecast.ts` (oder neuer `eta.ts`) Helper `etaToPlace(cell, target)`.

---

## Technische Details

- Keine API-Änderungen, keine neuen Dependencies.
- Nur Frontend/Präsentation plus zwei reine Helper in `lib/weather/storm/`.
- Datenfluss: `StormCell` bekommt zwei optionale Felder, gefüllt im Detection-Schritt (`detect.ts`/`severity.ts`). Wird nichts berechnet, bleiben Felder undefined und Labels lassen Zeilen einfach weg.
- ETA-Berechnung läuft im RadarMap-Setter, da dort sowieso die Cells durchiteriert werden und Favoriten/Active-Location via Props reingereicht werden müssen → kleine Erweiterung der `RadarMap`-Props (`namedTargets: {name: string; lat: number; lon: number}[]`).

---

## Offene Annahme

Echte dBZ/Echotop-Werte liegen aus den aktuellen Quellen (Blitzortung + Open-Meteo) **nicht** pro Zelle vor. Wir labeln die abgeleiteten Werte deshalb als Schätzung („~38 dBZ"). Wenn Du das so nicht willst, schmeißen wir Zeile 2 raus und zeigen stattdessen `Strikes/min` + `Radius km` — sag kurz Bescheid, sonst läuft Variante mit Schätzwerten.

---

## Liefergegenstand

- `src/components/dashboard/CurrentConditions.tsx` — Hero + Tabs-Layout.
- `src/components/radar/RadarMap.tsx` — Label-Format, Layer-Tuning, ETA-Targets.
- `src/lib/weather/storm/types.ts` — neue optionale Felder.
- `src/lib/weather/storm/severity.ts` — Reflectivity/Echotop-Schätzer.
- `src/lib/weather/storm/forecast.ts` (oder neu `eta.ts`) — ETA-Helper.
- `src/components/storm/severity-tokens.ts` — Severity-Labels.
- Aufrufer von `RadarMap` (`RadarCockpit.tsx`) — Favoriten/Active-Location als `namedTargets` reichen.