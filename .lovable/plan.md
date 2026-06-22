## Ziel

Drei Baustellen sauber lösen:

1. **Zellen-Drawer scrollbar** machen, damit Hazards/Forecast/Favoriten nicht abgeschnitten werden.
2. **Zugbahnen und ETA** sichtbar machen: bisherige Centroid-Historie wird nicht als Linie gerendert, ETA nur als Text. Wir zeichnen Past-Track + Forecast-Line + ETA-Marker pro Zelle.
3. **Background-Tracking**: Detection läuft heute nur, solange `/map` gemountet ist. Wir ziehen Stream + Tracking-Engine in einen globalen Service, damit Lebensdauer, Zugbahn und ETA in jeder Route verfügbar bleiben und Reload überleben.

---

## 1) Drawer scrollbar

`src/components/storm/StormCellDrawer.tsx`
- `DrawerContent` bekommt feste max-height, der Inhalt wandert in eine `<ScrollArea>` (shadcn) mit `h-[calc(85vh-…)]`.
- Header bleibt sticky, KPI-Grid + Sections scrollen darunter.
- Mini-Track-Visualisierung (siehe Punkt 2) wird als neue Section oben eingefügt.

## 2) Zugbahnen + ETA

### Map (`src/components/radar/RadarMap.tsx`)
- Neue Quelle `storm-past-src` (LineString pro Zelle aus `cell.history`), gerendert als durchgezogene Linie in Severity-Farbe, Opacity 0.7, Width 2.
- Neue Quelle `storm-past-points-src` (Centroid-Historie als kleine Kreise, ältere transparenter via `circle-opacity` per Datafield `ageNorm`).
- Bestehender `storm-fc-line` bleibt, zusätzlich `storm-eta-src` (Punkt-Layer) für +15/+30/+60 min Marker mit Label.
- `setStormCells()` füllt alle vier neuen Sourcen in einem Pass.

### Drawer-Mini-Track
- Kleine SVG-Komponente `StormTrackMini` zeigt normierten Past+Forecast-Pfad mit Pfeilspitze und Severity-Farbe. Reine Darstellung aus `cell.history` + `cell.forecast`.

### ETA-Karte im Cockpit
- `StormPanel` zeigt pro Zelle ETA zum aktiven Punkt prominenter, plus Top-3 Favoriten-ETAs aus `alerts`.

## 3) Background-Service

### Neuer Service `src/lib/weather/storm/background.ts`
- Singleton mit:
  - eigenem Blitzortung-WebSocket-Abo (start/stop, BBox = Europa-Default oder Union aller Favoriten)
  - 60-min Strike-Puffer
  - 15 s Tick → `stepStormTracking()` + Hazard-Engine optional
  - Listener-Registry, `getSnapshot()`, `subscribe(cb)`
- Persistenz: tracks (id, firstSeen, history komprimiert auf 1-min-Bins, lastSeen) in `localStorage` unter `meteoflo.storm.tracks.v1`, geladen beim ersten `start()`. Reload behält Lebensdauer + jüngste Zugbahn.
- Lifecycle: startet wenn `settings.storm.enabled`, stoppt sonst. Schreibt jede Minute snapshot.

### Provider + Hook
- `StormProvider` in `src/routes/__root.tsx` mountet einmalig, liest Settings + Favoriten, ruft `background.configure({...})`.
- `useStormTracking()` (refactor) liest nur noch `useSyncExternalStore` vom Service, kein eigener Stream, keine eigene Interval. Bestehende Aufrufer (`RadarCockpit`) bleiben kompatibel.
- `useLightningStream` im RadarCockpit bleibt zusätzlich für Karten-Rendering der Einzelblitze (BBox-spezifisch); der Background-Service nutzt eigenen Europe-BBox-Stream für Detection.

### Cross-Route-Nutzung
- `LocationSwitcher` Warnampel liest jetzt globalen Snapshot statt nur lokalen Stand.
- `routes/alerts.tsx` bekommt Sektion „Aktive Sturmzellen" mit Lebensdauer, Zugbahn-Mini und ETA pro Favorit.

---

## Technische Details

```text
RadarCockpit ──► useStormTracking() ─┐
LocationSwitcher ► useStormTracking()─┼──► StormBackgroundService (singleton)
alerts route   ──► useStormTracking()─┘        │
                                               ├─ Blitzortung WS (Europe bbox)
                                               ├─ stepStormTracking (15 s tick)
                                               ├─ Hazard-Engine
                                               └─ localStorage persist (1/min)
```

- `useStormTracking` Signatur bleibt erhalten, intern nur noch Wrapper um `useSyncExternalStore(service.subscribe, service.getSnapshot)`; Severity-Recompute für aktive `environment` passiert weiterhin pro Konsument-Render.
- Persistenz-Schema: `{ id, firstSeen, lastSeen, history: [{t,lat,lon,strikes}] }`, max 60 min, deduped auf 60 s.
- Reset bei Threshold-Wechsel weiterhin über `resetStormTracking()`, zusätzlich Service-API `service.reset()`.

## Out of Scope

- Push-Notifications oder Service-Worker-Background bleiben außen vor (Tab muss offen sein).
- Keine Änderungen an Hazard-Engine-Logik, nur Anbindung an den globalen Cell-Stream.
- Keine UI-Refactors außerhalb der genannten Stellen.
