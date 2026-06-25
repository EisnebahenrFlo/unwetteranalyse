## Ziel

Hochpräzises Radar-Cockpit ohne Blitzortung. Stormtracking aus dem DWD-Radar selbst (echte dBZ-Werte), nicht aus Blitzproxy. Intuitive Karte, klare Zell-Labels, ETA-Schätzungen, kein toter Code.

## Recherche und Architektur-Entscheidung

Drei Wege wurden geprüft, um Zellen ohne Blitze zu erkennen:

| Quelle | Präzision | Aufwand | Bewertung |
|---|---|---|---|
| RADOLAN RY Binär (DWD opendata, 5 min, 1 km, echte dBZ) | hoch | mittel (Parser + Proxy) | **gewählt** |
| WMS-PNG-Farben rückrechnen | mittel | gering, aber fragil | nur als visueller Layer |
| DWD KONRAD / CellMOS (fertige Cells) | hoch | unklare Verfügbarkeit, registrierte Schnittstelle | später als Upgrade |

Begründung: RY ist die gleiche Quelle, die DWD intern für Cell-Tracking nutzt. Mit echten dBZ-Werten lassen sich Zellen sauber per Threshold detektieren, Bewegung per Centroid-Matching schätzen und Konvektion (Top dBZ, Fläche, Trend) realistisch einordnen. CORS und Bundle-Größe werden durch eine TanStack-Server-Function umgangen, die das Binärformat im Worker liest und nur ein kompaktes JSON ausliefert.

## Abriss (was komplett raus muss)

Dateien löschen:
- `src/lib/weather/sources/blitzortung.ts`
- `src/lib/weather/hazards/lightning.ts`
- `src/lib/weather/storm/detect.ts` und `detect.test.ts` (DBSCAN auf Strikes)
- `src/lib/weather/storm/background.ts` (Lightning-WebSocket-Service)
- `src/components/radar/CockpitDiagnostics.tsx`-Panels, die rein Lightning sind (`BlitzRadarCard`, Teile von `TriggerLightCard`)
- `src/lib/weather/analysis/cockpit-diagnostics.ts` → reduziert auf radar-/modellbezogene Helfer
- `src/lib/weather/analysis/radar-cockpit.ts` → `analyseLightning` raus

In Dateien rausoperieren (kein Lightning-Code mehr):
- `src/lib/weather/hazards/engine.ts`, `hazards/types.ts`, `hazards/use-hazards.ts`, `hazards/alerts.ts`, `hazards/history.ts`, `hazards/hail.ts` (Lightning-Trigger weg, Hagel aus Radar-Top-dBZ + CAPE/SHEAR)
- `src/lib/weather/scoring/normalize.ts`, `scoring/today.ts`, `scoring/nowcast.ts`, `scoring/subscores.ts` → Lightning-Subscore entfernen
- `src/lib/storage/settings.ts` → Blitz-Toggles raus
- `src/routes/settings.tsx`, `src/routes/analysis.tsx`, `src/components/analysis/NowcastTable.tsx`, `src/components/hazards/*`, `src/components/storm/*` → Lightning-Anzeigen entfernen
- `package.json` → `pako` / WebSocket-Helper raus, falls nur für Blitzortung genutzt

Tests: `storm/detect.test.ts`, `hazards/types.test.ts`-Anteile zu Lightning streichen. Suite muss grün bleiben.

## Neue Module

### 1. Server-Side Radar-Daten

`src/lib/weather/sources/radolan-ry.server.ts`
- holt das jüngste RY-Produkt von `https://opendata.dwd.de/weather/radar/radolan/ry/`
- entpackt das `bz2`/`tar.gz`-Bundle (nur Node-kompatible Libs; Worker-Limits beachten — ggf. nur das letzte gz-Produkt einzeln laden)
- parst RADOLAN-Binärformat → `Float32Array` dBZ + Geo-Header (Polarstereographische Projektion, 900×900, 1 km)
- konvertiert in Lon/Lat-Bounds via offiziellem RADOLAN-Grid

`src/lib/weather/sources/radolan-ry.functions.ts`
- `createServerFn` `getRadarSnapshot()` liefert: `{ timeISO, cells: RadarCell[], grid: { minLon, minLat, maxLon, maxLat, cols, rows } }`
- `RadarCell` = `{ id?, centroid, polygon, areaKm2, topDbz, meanDbz, hailCoreDbz }`
- intern Cell-Detection: Threshold 35 dBZ, Connected-Component-Labeling (zweistufig: 35 dBZ Hülle, 50 dBZ Kern), Mindestfläche 8 km², Polygon-Vereinfachung
- Antwort cached (Cache-Header 60 s), Frame-Zeit als HTTP-ETag

### 2. Tracking im Browser

`src/lib/weather/storm/tracker.ts` (ersetzt `track.ts` und `detect.ts`)
- nimmt Cell-Listen aus mehreren aufeinanderfolgenden RY-Frames
- matcht Zellen frame-zu-frame per Greedy-Nearest auf Centroid (max 15 km in 5 min)
- schätzt Bewegung aus den letzten 3 Centroiden (mittlere Geschwindigkeit, Bearing, Confidence aus Streuung)
- baut Forecast-Polyline +15 / +30 / +60 min und Cone (Streuwinkel aus Bewegungs-Confidence)
- vergibt persistente IDs `cell-NNN`, Lebensdauer-Tracking, TTL 30 min
- pure TS, vollständig testbar

`src/lib/weather/storm/severity.ts` (umbauen)
- Inputs: `topDbz`, `hailCoreDbz`, `areaKm2`, `trend` (dBZ-Top und Fläche letzte 15 min), optional `cape`, `shear`
- Stufen 1–4 nach DWD-Kriterien (siehe Wettergefahren-Skill: `references/dwd-severity.md`)
- liefert `{ score, level, reasons[] }`

`src/lib/weather/storm/use-storm-tracking.ts`
- React-Hook, pollt `getRadarSnapshot()` per `useQuery` alle 60 s
- führt Tracker-Step im Client durch, hält Historie im Ref
- gibt `{ cells, alerts, snapshotTime, status }` zurück

`src/lib/weather/storm/background.ts` neu, schlank:
- kein WebSocket mehr, nur Persistenz der Track-Historie über `localStorage`
- gleicher Zweck wie bisher, aber Quelle ist der `getRadarSnapshot()`-Polling-Tick

### 3. Map & Cockpit

`src/components/radar/RadarMap.tsx`
- Lightning-Layer raus (`lightning-src`, `lightning-layer`, `setLightning`)
- bestehende Storm-Layer (Polygon, Cone, Forecast-Pfad, ETA-Marker, Labels) bleiben
- zusätzlich: Hail-Core-Layer (Reflektivität ≥ 50 dBZ als gefüllter Punkt mit Pulse-Animation)

`src/components/radar/RadarCockpit.tsx`
- `useLightningStream` raus, `useStormTracking` umgebaut
- Mode-Defs bleiben (Fokus DE / Mitteleuropa / Bodencheck)
- Topbar-HealthPills: RY und WN bleiben, „Blitz“ wird ersetzt durch „Stormtrack“ (Frames + Zellenzahl + Lag)
- Layer-Toolbar: „Blitze“-Toggle raus, dafür „Hagelkerne ≥50 dBZ“ und „Zugbahn“
- Aside-Cards: `BlitzRadarCard` weg, `TriggerLightCard` wird zu `ConvectionTriggerCard` (CAPE/LI/SHEAR + Top-dBZ-Trend statt Blitzfrequenz)

`src/components/storm/StormPanel.tsx`, `StormCellDrawer.tsx`, `StormAlertBanner.tsx`
- Felder „Strikes/min“, „Strike-Trend“ raus, dafür „Top-dBZ“, „Fläche km²“, „Trend dBZ/15 min“
- Severity-Begründung aus den neuen `reasons[]`

### 4. Settings / Routen

- `src/routes/map.tsx`: Meta-Description ohne „Blitzortung“
- `src/routes/settings.tsx`: Lightning-Section komplett raus, Storm-Section um Quelle „DWD RADOLAN RY“ ergänzen
- `src/routes/analysis.tsx`: Lightning-Spalte und Insights raus
- `src/lib/storage/settings.ts`: `lightning`-Keys entfernen, Migration nicht nötig (Lokal-Storage darf einfach veralten)

## Vorgehen in Schritten

1. **Server-Function bauen**: RADOLAN-RY-Endpoint + Parser + Cell-Detection, Smoke-Test gegen Live-Daten.
2. **Tracker + Severity neu**: pure TS-Module, Vitest-Tests für Matching, Motion und Severity-Stufen.
3. **Hook + Background umbauen**: Polling, Persistenz, Snapshot-API.
4. **RadarMap & Cockpit umbauen**: alle Lightning-Pfade entfernen, neue Layer und Panels einhängen.
5. **Hazards, Scoring, Settings, Routen säubern**: alle verbliebenen Lightning-Referenzen rausoperieren.
6. **Dateien löschen**: blitzortung.ts, alte detect/track-Module, lightning-spezifische Komponenten und Tests.
7. **Tests & Build**: Vitest grün, ESLint grün, `npm run build` grün, Karte manuell prüfen (Live-Frames + mindestens eine erkannte Zelle bei aktiver Konvektion).

## Technische Hinweise

- RADOLAN-Binärparser ist überschaubar (ASCII-Header bis ETX, dann 16-Bit-Werte). Spezifikation: DWD-RADOLAN-Format-Beschreibung. Worker-Runtime ist OK, nur `bz2`-Dekompression vermeiden — einzelne `.gz`-Frames laden, `zlib` ist im Worker verfügbar.
- Connected-Component-Labeling: zweipass 4-Konnektivität auf der dBZ-Maske, anschließend Polygon-Außenkante per Marching Squares, Douglas-Peucker-Simplify auf ≤ 32 Punkte.
- Severity-Schwellen kommen aus dem Wettergefahren-Skill (`references/dwd-severity.md`), nicht aus dem Bauch.
- Open-Meteo-CAPE/LI/SHEAR aus dem bestehenden `cellEnv`-Mechanismus weiterverwenden, lediglich Eingangsdaten kommen jetzt aus Radar-Zellen.
- Map-Performance: Polygon-Anzahl ≤ 50 Zellen pro Frame, sonst Filter nach Severity ≥ 2.

## Risiken und offene Punkte

- DWD-opendata-Latenz typischerweise 3–6 min. UI muss „letzter Frame X min alt“ ehrlich anzeigen.
- Cell-Detection ohne Doppler liefert keine Rotation/Mesozyklon-Erkennung. Superzellen-Hinweis nur via Umgebung (SHEAR + CAPE) und Persistenz/Bewegung.
- Wenn die Server-Function im Worker an Speicher-/CPU-Limits stößt, fällt das Cockpit zurück auf reine WMS-Anzeige ohne Tracking — Fehlerpfad muss eingebaut sein.
- Wenn Du KONRAD/CellMOS später lizenzieren willst, lässt sich der `getRadarSnapshot`-Endpoint austauschen, ohne Frontend zu ändern.
