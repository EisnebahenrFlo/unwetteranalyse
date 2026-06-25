# Stormtracking: Geo-Filter & Label-Refresh

## Ziel
- Zellerkennung räumlich auf DACH (DE/AT/CH/LI) + Italien begrenzen, mit 50 km Puffer um Randzellen nicht zu verlieren.
- Zell-Labels entrümpeln: weniger Zeilen, lesbar, sinnvolle Namen, keine erfundenen dBZ-Schätzwerte mehr.
- ETA-Ziel klar benennen, sonst weglassen.

## 1. Geo-Filter (DACH + IT, BBox + 50 km Puffer)

**Neue Datei** `src/lib/weather/storm/region.ts`
- Export `DACH_IT_BBOX = { west: 5.5, south: 35.5, east: 18.7, north: 55.5 }` (umfasst DE/AT/CH/LI/IT inkl. Inseln).
- Export `DACH_IT_BUFFER_KM = 50`.
- Helper `isInRegion(lat, lon, bufferKm = 50)`: BBox-Test mit `bufferKm` in Grad umgerechnet (lat: km/111.32, lon: km/(111.32·cos(lat))).

**`src/lib/weather/storm/background.ts`** (`tick()`)
- Vor Übergabe an `stepStormTracking`: `const strikes = this.buffer.filter(s => isInRegion(s.lat, s.lon))`.
- Buffer selbst bleibt unverändert (volle Blitz-Darstellung weiterhin möglich); nur die Detection-Eingabe wird gefiltert.
- Nach Tracking zusätzlich: `cells = cells.filter(c => isInRegion(c.centroid.lat, c.centroid.lon, 0))` — Zellen, deren Zentrum aus der Pufferzone heraus driftet, fallen sauber raus.

## 2. Zell-Namen (besser lesbar)

Aktuell sind IDs wie `C-1734567890-12` nicht scannbar. Stattdessen ein kurzer, stabiler Anzeigename:
- Format: `Zelle DE-A1`, `Zelle IT-B3`, … (Landpräfix aus Centroid + Buchstabe/Zahl je Severity-Reihenfolge in der aktuellen Tick-Ausgabe).
- Implementierung: in `background.ts` nach `cells.sort(...)` ein `displayName` ableiten (Land via grober BBox-Zuordnung DE/AT/CH/IT/—, Index nach Severity-Rang).
- Feld `displayName?: string` in `StormCell` (`src/lib/weather/storm/types.ts`) ergänzen, ohne bestehende `id` zu brechen.

## 3. Labels: zoom-abhängig (Smart)

Bisher 4 Zeilen immer sichtbar → überladen, dBZ/Top sind Proxys. Neuer Aufbau in `RadarMap.tsx` (`renderStormCells` + Layer `storm-labels`):

**Daten pro Centroid-Feature**:
- `labelShort`: `Zelle DE-A1 · SCHWER`
- `labelLong`: zwei Zeilen, z. B.
  - Zeile 1: `Zelle DE-A1 · SCHWER`
  - Zeile 2: `38 km/h → NO` *(nur wenn `motion.speedKmh > 1`)*
- `labelEta`: dritte Zeile *nur* wenn ETA ≤ 60 min UND Zielname vorhanden, Format `→ Ansbach 24 min`.

**Layer-Expression** (`text-field`):
```
["step", ["zoom"],
  ["get", "labelShort"],          // zoom < 7: Pill-Style
  7, ["get", "labelMid"],         // 7..9: 2 Zeilen
  9, ["get", "labelFull"]         // ≥ 9: bis 3 Zeilen inkl. ETA
]
```
- `text-size`: `["interpolate", ["linear"], ["zoom"], 5, 10, 7, 11, 10, 13]`
- `text-anchor: "top-left"`, `text-offset: [0.9, 0.5]`, `text-justify: "left"`, `text-line-height: 1.15`
- `text-halo-width: 2`, `text-halo-color: #ffffff`
- Kollision aktiv: `text-allow-overlap: false`, `text-ignore-placement: false`, `symbol-sort-key` nach Severity-Rang (höchste zuerst, niedrigere weichen).

**Entfernt**: dBZ/Top-Zeile sowie `estimateReflectivityDbz` / `estimateEchoTopKm` aus dem Label. Funktionen bleiben in `estimate.ts` für den Drawer (mit klarer „Schätzung“-Markierung), werden aber nicht mehr in der Karte gerendert.

## 4. ETA-Zeile (nur sinnvoll)

`etaToNearestTarget` in `estimate.ts` strenger machen:
- Liefert `null`, wenn:
  - kein Zielort innerhalb 80 km vor der Zelle (in Bewegungsrichtung, Winkelabweichung ≤ 60°), oder
  - ETA < 0 min oder > 90 min, oder
  - `motion.speedKmh < 5` (driftende Zelle, ETA nicht aussagekräftig).
- Sonst `{ target, minutes }` wie bisher.

## 5. Severity-Drawer (`StormCellDrawer.tsx`)

Da dBZ/Top aus dem Karten-Label fliegen, im Drawer als „Geschätzt aus Blitzrate & Radius“ deutlich kennzeichnen (Tooltip + Suffix `~`). Keine weiteren Änderungen.

## Technische Details

**Geänderte Dateien**
- neu: `src/lib/weather/storm/region.ts`
- `src/lib/weather/storm/types.ts` — Feld `displayName?: string`
- `src/lib/weather/storm/background.ts` — Region-Filter, Vergabe `displayName`
- `src/lib/weather/storm/estimate.ts` — strengere ETA-Logik
- `src/components/radar/RadarMap.tsx` — Label-Felder + zoom-step Expression, Kollision aktiv, dBZ raus
- `src/components/storm/StormCellDrawer.tsx` — Schätz-Kennzeichnung

**Nicht-Ziele**
- Kein Wechsel zu Polygon-Filter (BBox + Puffer reicht laut Entscheidung).
- Keine Änderungen an Zugbahn/Cone/ETA-Punkten auf der Karte selbst.
- Keine neue Datenquelle für echte dBZ-Werte (späterer Schritt).
