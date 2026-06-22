
# Stormtracking Modul

Ziel: ein echtes, meteorologisch belastbares Stormtracking, integriert in die bestehende Radar/Map Seite. Erkennen, Verfolgen, Vorhersagen, Warnen.

## Datenquellen

- **DWD Radar RV/WN** (bereits via `dwd-radar.ts` / `dwd-wms.ts`): Reflektivität als Grundlage für Zellenerkennung.
- **Blitzortung** (`blitzortung.ts`): Live Strikes für Strike Rate und Schwere pro Zelle.
- **Open Meteo Konvektion** (`open-meteo.ts`): CAPE, Lifted Index, Shear, Updraft Helicity für Umgebungs Severity.
- **DWD CAP Warnungen**: Polygone zur Korrelation mit getrackten Zellen.

Fokus: Europa. Radar bleibt DACH zentriert, Blitze und Modelle europaweit.

## Modul Architektur

```text
src/lib/weather/storm/
  types.ts              StormCell, StormTrack, StormForecast, StormAlert
  detect.ts             Zellenerkennung aus Radar Composite (Schwellwert + Cluster)
  identify.ts           Zell IDs, Polygon, Centroid, Fläche, Max dBZ, Top
  track.ts              Matching zwischen Frames, Speed/Heading, Historie
  forecast.ts           Lineare + gewichtete Extrapolation 0..60 min, Cone of Uncertainty
  severity.ts           Score aus dBZ, Strike Rate, CAPE, LI, Shear, Hagel Proxy (VIL Surrogate)
  alerts.ts             ETA pro Favorit, Schwellwert Logik, Dedup, Cooldown
  queries.ts            TanStack Query Hooks: useStormCells, useStormTracks, useStormAlerts
```

Logik strikt getrennt von UI. Alle Funktionen pure und typisiert.

## Algorithmus Kurzfassung

1. **Detect**: Radar Frame in Grid lesen, Schwellwert (z.B. ≥ 35 dBZ Kern, ≥ 25 dBZ Hülle), Connected Components Clustering.
2. **Identify**: Pro Cluster Polygon vereinfachen, Centroid, Fläche km², Max/Mean dBZ, Höhe falls verfügbar.
3. **Track**: Frame N gegen N-1 matchen via Nearest Centroid + Größen/Intensitäts Ähnlichkeit, Hungarian light. Persistente ID, History Ring Buffer (letzte 60 min).
4. **Forecast**: Speed/Heading aus letzten 3..6 Frames, gewichtete Mittelung, Cone wächst mit Tracking Unsicherheit. Pfad in 5 min Schritten bis +60 min.
5. **Severity**: Score 0..100 aus Reflektivität, Strike Rate Trend, CAPE/LI am Zellenort, DLS/SRH, Hagel Proxy. Stufen ruhig, beobachten, ernst, schwer.
6. **Alerts pro Favorit**: Für jeden Favoriten und jede Zelle ETA bis Cone den Favoriten schneidet. Wenn ETA ≤ konfigurierbare Schwelle und Severity ≥ Schwelle, Alert erzeugen. Dedup über Zell ID + Favorit, Cooldown 10 min.

## UI Integration in `src/routes/map.tsx`

Layer und Panels, keine neue Route.

- **Layer Toggle** auf der Karte: Zellen Polygone, Centroid + ID, Bewegungs Vektor, Forecast Pfad, Cone, Strikes, CAP Polygone. Default an: Polygone, Vektor, Cone.
- **StormCellList** Panel rechts (Desktop) bzw. Bottom Sheet (Mobile): sortierbar nach Severity, ETA zum aktiven Ort, Distanz. Tap öffnet `StormCellDrawer`.
- **StormCellDrawer**: Steckbrief der Zelle. Max dBZ, Fläche, Speed/Heading, Lebensdauer, Strike Rate Trend Sparkline, CAPE/LI am Zellort, Severity Begründung, Forecast Tabelle (+15/+30/+45/+60 min), betroffene Favoriten mit ETA.
- **StormAlertBanner**: oben auf der Karte und im Cockpit, wenn Alerts für Favoriten aktiv sind. Klar, sachlich, mit ETA und Severity.
- **DataFreshness**: Radar Alter, Blitz Alter, Modell Run sichtbar.

Komponenten:
```text
src/components/storm/
  StormLayer.tsx          Render auf bestehender Map (Polygone, Vektor, Cone, Strikes)
  StormCellList.tsx       Liste + Filter (nur schwere, nur relevante)
  StormCellDrawer.tsx     Detail Drawer
  StormAlertBanner.tsx    Aktive Favoriten Alerts
  StormLegend.tsx         Farben Severity, Pfeil = Bewegung, Cone = Unsicherheit
```

## Favoriten Alerts

- Quelle Favoriten: `use-saved-locations`.
- Persistenz Alert State: `localStorage` Key `storm-alerts-v1` für Cooldown und gesehene Alerts.
- Anzeige: Banner auf Map und Cockpit, plus Warnampel pro Favorit im `LocationSwitcher` zeigt Storm Severity zusätzlich zur bestehenden Hazard Ampel.
- Konfiguration in `settings.tsx`: ETA Schwelle (Minuten), Severity Schwelle, an/aus.

Hinweis: keine Push Notifications in dieser Stufe, nur In App. Push wäre ein separater Schritt (Service Worker + Permission), bewusst nicht im Scope.

## Performance

- Detection nur bei neuem Radar Frame, Ergebnis cachen (Query Key inkl. Frame Timestamp).
- Tracking inkrementell, nicht jeden Frame von Null.
- Polygone vereinfachen (Douglas Peucker) vor dem Rendern.
- Web Worker für Detection/Tracking, damit UI flüssig bleibt (`storm.worker.ts`).

## States

Loading, Empty (keine Zellen erkannt), Error (Radar Quelle aus), Stale (Daten älter als 15 min) sauber abbilden. Bei Quellenproblem klare Meldung statt leerer Karte.

## Settings

Neue Sektion „Stormtracking“ in `settings.tsx`:
- Layer Defaults
- Alert Schwellen (ETA min, Severity Stufe)
- Quellen an/aus (Blitz, CAP)

## Umsetzungsschritte

1. Typen + leere Module unter `src/lib/weather/storm/` anlegen.
2. `detect.ts` und `identify.ts` mit echtem Clustering auf RV Composite.
3. `track.ts` + Ring Buffer + Persistenz im Memory Store.
4. `forecast.ts` inkl. Cone.
5. `severity.ts` mit Open Meteo Konvektionsdaten am Zellort.
6. `alerts.ts` + Favoriten Verknüpfung.
7. Worker auslagern.
8. UI Komponenten + Integration in `routes/map.tsx`.
9. Settings ergänzen.
10. Warnampel im `LocationSwitcher` um Storm Severity erweitern.

## Bewusst nicht im Scope

- Push Notifications (separater Schritt).
- Eigene historische Storm DB (alles in Memory + LocalStorage Light).
- ML basierte Nowcasts. Erst solide deterministische Basis, ML später optional.
