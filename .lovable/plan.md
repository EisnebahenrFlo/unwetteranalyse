# Hazard Engine: Hagel, Sturzflut, Blitz (echt, nicht Proxy)

Ziel: Aus den drei bisher heuristischen Bereichen wird ein eigenständiges **Hazard-Modul** mit physikalisch fundierter Erkennung, persistentem Verlauf und Alerts pro Favorit. Nur offene Quellen, DACH voll, Europa best effort.

## Architektur

Neuer Layer `src/lib/weather/hazards/` parallel zu `storm/`. Storm-Modul liefert weiter Zellen-Geometrie, das Hazard-Modul hängt pro Zelle und pro Ort Diagnosen an.

```text
hazards/
  types.ts            # HailDiagnosis, FlashFloodDiagnosis, LightningDiagnosis
  hail/
    poh.ts            # Waldvogel + Foote/Krauss POH aus Reflektivität + Freezing Level
    meshs.ts          # Maximum Expected Severe Hail Size (Witt 1998)
    echo-top.ts       # Echo-Top aus DWD HX / Composite
  flood/
    radolan.ts        # RW/RY Akkumulation pro Pixel, 1h/3h/6h/24h
    return-period.ts  # KOSTRA-DWD Wiederkehrzeit (statisch eingebettet, Raster)
    ffi.ts            # Flash-Flood-Index = Niederschlag / KOSTRA-Schwelle * Topo-Faktor
    pegel.ts          # Pegelonline (WSV) als Verifikation für DACH
  lightning/
    cluster.ts        # bessere DBSCAN + ST-Clustering, Persistenz
    rate.ts           # Jump-Detection (Schultz), CG/IC-Schätzung über Multiplizität
  history/
    store.ts          # IndexedDB Persistenz pro Favorit
    aggregator.ts     # 24h Pfade, Trend-Buckets
  engine.ts           # Orchestriert pro Tick: cells → diagnosen → alerts → history
  use-hazards.ts      # React-Hook (analog use-storm-tracking)
```

## Datenquellen (alle offen, kein Key)

| Hazard | Quelle | Endpoint | Auflösung |
|---|---|---|---|
| Hagel | DWD OpenData RADOLAN **HX** (Hagelklassen) | `opendata.dwd.de/.../radolan/hx/` | 1 km, 5 min, DACH |
| Hagel | DWD RV-Composite (dBZ) + Freezing Level (Open-Meteo) | bereits vorhanden | 1 km / 1 h |
| Hagel | ESSL European Severe Weather Database (Verifikation, optional) | `eswd.eu` JSON | Europa, gemeldet |
| Sturzflut | DWD **RADOLAN RW** (stündlich) + **RY** (5 min, Realtime) | `opendata.dwd.de/.../radolan/rw/` | 1 km |
| Sturzflut | EFAS Flash Flood (JRC) für Europa-Fallback | `early-warning.copernicus.eu` | 5 km |
| Sturzflut | KOSTRA-DWD 2020 Rasterdaten (statisch, gebündelt) | offline einbetten | 8 km |
| Sturzflut | WSV Pegelonline (Verifikation) | `pegelonline.wsv.de/webservices/rest-api` | live, DACH |
| Blitz | Blitzortung (vorhanden) | bereits vorhanden | live, global |
| Blitz | DWD CAP-Warnungen (Verifikation) | bereits vorhanden | DACH |

Quellen ohne CORS werden über einen schmalen Server-Route-Proxy (`src/routes/api/public/hazards/*`) geleitet. RADOLAN-Binärformat parsen wir serverseitig zu kompaktem GeoJSON-Grid, damit der Client nicht 1-MB-Blobs verarbeiten muss.

## Hagel-Erkennung

1. **Echo-Top H45**: aus 3D-Radar nicht verfügbar offen, daher Proxy aus HX-Klasse + RV-Maximum.
2. **POH (Probability of Hail)** nach Waldvogel:
   `POH = f(H45 - H0)` mit `H0` = Freezing Level (Open-Meteo).
3. **MESHS (Maximum Expected Severe Hail Size)** nach Witt: integriert Reflektivität oberhalb H0.
4. Ergebnis pro Storm-Zelle: `{ pohPercent, meshsMm, classification: none|small|severe|giant }`.
5. Visualisierung: Hagel-Layer (POH > 50 % gelb, > 80 % rot, MESHS-Label), Zellen-Drawer zeigt Begründung („HX-Klasse 4, RV 58 dBZ, H0 3.200 m → POH 78 %, MESHS 2.3 cm").

## Sturzflut-Erkennung

1. **Niederschlag-Akkumulation** pro 1 km RADOLAN-Pixel über 1 h / 3 h / 6 h / 24 h.
2. **KOSTRA-Vergleich**: gemessene Summe ÷ KOSTRA-Schwelle für T = 10 / 30 / 100 Jahre.
3. **Topo-Faktor**: Hangneigung + Einzugsgebiet aus eingebettetem DEM-Hash (8 km), erhöht Faktor in Steillagen.
4. **Flash-Flood-Index FFI** 0..100, Stufen: ruhig / beobachten / gefährdet / kritisch.
5. **Pegel-Cross-Check**: nahe Pegel mit Trend > steigend stark verstärken Severity, sinkend dämpfen.
6. Europa-Fallback: nur EFAS-Flash-Flood-Wahrscheinlichkeit, sichtbar als „Daten reduziert".
7. Visualisierung: Niederschlags-Heatmap, FFI-Marker pro Gemeinde-Bbox, Drawer mit Säulen 1 h / 3 h / 24 h vs. T-Schwellen.

## Blitz qualitativ (Ausbau bestehend)

1. **Spatio-temporales Clustering** (statt rein räumlich): persistente Cluster-IDs über Zeit.
2. **Lightning-Jump-Algorithmus (Schultz)**: σ-Anstieg der Rate > 2 in 2 min markiert Eskalation als Frühindikator für Hagel/Tornado.
3. **CG/IC-Heuristik**: Blitzortung liefert keine Polarität, aber Multiplizität + Stations-Count erlauben Schätzung wahrscheinlich CG vs. wahrscheinlich IC.
4. Severity bekommt neue Faktoren: Jump + CG-Anteil.
5. Visualisierung: bestehendes Strike-Layer + Jump-Pulse-Indikator pro Zelle.

## Alerts pro Favorit

Erweitert `storm/alerts.ts` zu `hazards/alert-engine.ts`:

- Pro Favorit, pro Hazard eigene Schwelle (Hagel: POH oder MESHS, Sturzflut: FFI oder Wiederkehrzeit, Blitz: ETA + Jump).
- ETA aus Storm-Forecast-Cone (vorhanden) + Niederschlags-Nowcast WN (vorhanden).
- Cooldown 10 min pro `favoriteId + hazardType`, persistent in localStorage.
- Warnampel im LocationSwitcher zeigt höchsten Hazard.

## Verlauf

`history/store.ts` schreibt pro Favorit in IndexedDB:
- `hazardEvents`: jeder Übergang `level↑` mit Snapshot (Werte, Quellen, Zeit).
- `dailyAggregates`: pro Tag Max-POH, Max-FFI, Strike-Count.
- Retention 30 Tage.

UI: neuer Tab „Verlauf" im Favoriten-Drawer mit drei Tracks (Hagel, Sturzflut, Blitz), Mini-Heatmap der letzten 24 h, klickbare Events öffnen Snapshot.

## UI-Integration

- **Map (`map.tsx`)**: neue Layer-Toggles „Hagel", „Sturzflut", „Blitz-Jump". Bestehende Storm-Layer bleiben.
- **StormCellDrawer**: bekommt drei Abschnitte „Hagel / Niederschlag / Elektrik" mit Klartext-Begründung.
- **Cockpit**: Hazard-Zeile unter Storm-Alert-Banner.
- **Settings**: pro Hazard Schwellenwerte + Toggles + Retention-Dauer.

## Performance

- RADOLAN-Parsing nur serverseitig (`/api/public/hazards/radolan/:product`), Antwort als komprimiertes GeoJSON, 5 min Cache-Header.
- KOSTRA + DEM als statische JSON-Blöcke (~150 kB gzip) im Bundle, kein Runtime-Fetch.
- Hazard-Engine läuft im selben 15-s-Tick wie Stormtracking, alle Pixel-Operationen gegen `Float32Array`.
- IndexedDB-Writes gebatcht alle 60 s.

## Lieferschritte

1. Types + Engine-Skeleton + Hook (`use-hazards.ts`) ohne Datenquellen.
2. Server-Routes für RADOLAN RW/RY/HX + Open-Meteo Freezing Level.
3. Hagel-Diagnose (POH, MESHS) + Layer + Drawer-Sektion.
4. KOSTRA-Daten einbetten, FFI-Berechnung, Flood-Layer + Drawer.
5. Pegelonline-Anbindung als Verifikation.
6. Lightning-Jump + CG-Heuristik in bestehende Storm-Severity einhängen.
7. History-Store + Favoriten-Drawer-Tab „Verlauf".
8. Alert-Engine pro Hazard + Warnampel-Erweiterung.
9. Settings-Sektion.

## Bewusst nicht enthalten

- Keine kommerziellen Quellen (LINET, Meteomatics, MESHS-Vendor).
- Kein ML-Nowcast, alles deterministisch und nachvollziehbar.
- Keine Push-Notifications (separates Modul).
- Kein 3D-Radar (offen für DACH nur 2D verfügbar) — POH bleibt damit Best-Effort.
- ESSL-Hagelmeldungen optional, nicht in v1.
