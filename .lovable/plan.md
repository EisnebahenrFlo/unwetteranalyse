# Radar-Cockpit-Umbau

Ziel: Aus der bestehenden App ein operatives, kostenfreies Unwetter-Radar-Tool machen. Eine zentrale Karte mit intelligenten Layern, sauberem Zeitregler, Blitz-Live-Bestätigung und kompakter Analyseleiste. Bestehende Funktionen, Datenmodelle und Routen außerhalb der Karte bleiben unangetastet.

## 1. Datenquellen-Layer (alle kostenlos)

DWD GeoServer WMS (verifiziert vorhanden):

- **RY** → `RADOLAN-RY`, 5-min Beobachtung, Hauptlayer
- **WN** → `Radar_wn-product_1x1km_ger`, Nowcast bis +2 h in 5-min-Schritten
- **PI / Mitteleuropa** → `Radar_eucom_zeros` (EU-Composite des DWD)
- **QY / Qualitätslayer**: im öffentlichen DWD-WMS nicht als separater Layer verfügbar. Lösung: aus der WMS-Capabilities die jeweils letzte verfügbare Frame-Zeit pro Layer + Frame-Lücken extrahieren und als "Datenvertrauen"-Signal anzeigen (frisch / verzögert / Lücken). So bleibt die Qualitätsaussage real und nicht erfunden. Falls später ein QY-Endpoint gefunden wird, kann er als Tile-Layer ergänzt werden, die UI-Slot dafür existiert.
- **Blitze** → Blitzortung.org via öffentlichem WebSocket `wss://ws1.blitzortung.org/`. Live-Strikes werden im Browser empfangen, in 0–5 / 5–15 / 15–30 min gestaffelt als GeoJSON-Layer dargestellt.
- **Stationen** → Bright Sky `/current_weather` für Punkte rund um Kartenmitte (bereits im Code vorhanden, wird wiederverwendet).
- **Warnungen** → Bright Sky `/alerts` als optionaler dezenter Polygon-Layer (bereits angebunden).

## 2. Produktstruktur

Die Karte wird zur Hauptansicht. Routen-Update:

- `/` Dashboard bleibt als Lage-Übersicht, bekommt aber unten einen Quick-Link "Radar-Cockpit öffnen"
- `/map` wird zum **Radar-Cockpit** (kompletter Umbau)
- Restliche Routen (`/analysis`, `/alerts`, `/models`, `/stations`, `/learn`, `/settings`) unverändert

Drei Karten-Modi, oben rechts als Segmented Switch:

1. **Fokus DE** – Zentrum DACH, RY Standard, WN über Zeitregler, Blitz/Stationen/Warn zuschaltbar
2. **Mitteleuropa** – PI (`Radar_eucom_zeros`), weiter herausgezoomt, Blitz zuschaltbar
3. **Bodencheck** – RY gedimmt + große Stations-Pins mit Wind/Böen/Druck/Taupunkt

## 3. Layout des Cockpits

```text
+--------------------------------------------------------------+
| Topbar: Modus [Fokus DE | Mitteleuropa | Bodencheck]         |
|         Quellenstatus · Letzte Aktualisierung · Datenvertrauen|
+----------------------------+---------------------------------+
|                            | Analyseleiste                   |
|                            |  · Jetzt                        |
|         Hauptkarte         |  · Nächste 30 min               |
|       (volle Höhe)         |  · Nächste 2 h                  |
|                            |  · Datenvertrauen               |
|                            |  · Aktive Layer                 |
+----------------------------+---------------------------------+
| Zeitregler:  [-2h … Jetzt … +2h Nowcast]   Play/Pause  Step  |
| Layer-Toolbar: RY  WN  PI  Blitz  Stationen  Warnungen  QY   |
+--------------------------------------------------------------+
```

- Desktop: Karte links (≈ 70 %), Analyseleiste rechts (≈ 30 %), unten Zeitregler + Layer-Toolbar als ein Streifen
- Mobile: Karte oben (60 vh), darunter Zeitregler, Layer-Toolbar horizontal scrollbar, Analyseleiste als ausklappbares Bottom-Sheet

## 4. Karten- und Layer-Architektur

Neuer Ordner `src/lib/weather/sources/dwd-wms.ts`:

- konstanten für RY / WN / PI inkl. Layer-Name, Capabilities-Selector, Default-Frame-Schritt
- `fetchWmsTimeline(layer)` → Liste der verfügbaren Frame-Zeiten + `latest`, `oldest`, `stepMs`, `lagMs`
- `wmsTileUrl(layer, time)` baut die Tile-URL für maplibre

Neuer Ordner `src/lib/weather/sources/blitzortung.ts`:

- `useLightningStream({ enabled, bbox })` Hook mit WebSocket-Connect, automatischer Reconnect-Backoff, In-Memory-Buffer der letzten 60 min, Bbox-Filter clientseitig
- Strikes werden mit Alter klassifiziert (0–5 / 5–15 / 15–30 min) für die Farbgebung

`src/components/map/WeatherMap.tsx` wird zur „dummen“ Map-Shell (Init, Resize, Center) und exportiert imperative Hooks (`setRasterLayer`, `setGeoJsonLayer`, `clearLayer`). Die gesamte Layer-Orchestrierung passiert in einer neuen Cockpit-Komponente, damit Karte performant bleibt:

- Nur **ein** Raster-Layer gleichzeitig sichtbar (RY oder WN oder PI)
- WN-Frames werden lazy nachgeladen (nur wenn Modus Nowcast aktiv ist)
- Bei Frame-Wechsel wird ausschließlich der `tiles`-Source ausgetauscht, nicht der Layer neu erzeugt → kein Flackern, kein Map-Reload
- Animation läuft per `requestAnimationFrame`-Throttle (max 1 Frame / 600 ms), pausiert automatisch beim Pan/Zoom

## 5. Zeitregler-Logik

Ein einziger Slider, dreiteilig:

```text
[-2 h ……… Jetzt ……… +2 h]
   RY-Verlauf      WN-Nowcast
```

- Position links von „Jetzt“ → RY-Frame zum gewählten Zeitpunkt
- Position rechts von „Jetzt“ → WN-Frame
- Snap auf 5-min-Raster, Play-Button spielt nahtlos -30 min → +30 min
- Aktueller Modus (Verlauf / Jetzt / Nowcast) wird als farbige Badge oben am Slider angezeigt

## 6. Analyseleiste (rechts)

Vier Blöcke, jeder ist eine kleine Karte mit einer Headline + 1–2 Belegen:

- **Jetzt**: stärkste RY-Intensität im sichtbaren Bbox, Anzahl Blitze letzte 5 min, höchste Bö aus Stationen
- **Nächste 30 min**: Trend Niederschlagsintensität aus WN-Frames +0…+30, Richtung der Verlagerung (vektoriell aus 3 Frames), Blitz-Trend (steigend/fallend/konstant)
- **Nächste 2 h**: Peak-Intensität aus WN, Zeitpunkt des Peaks, ob neue Zellen am Westrand entstehen
- **Datenvertrauen**: Frische der RY/WN/PI-Frames (min seit letzter Aktualisierung), erkannte Frame-Lücken, Blitz-Stream-Status, Stationsabdeckung im Bbox

Logik liegt in `src/lib/weather/analysis/radar-cockpit.ts`. Keine Behauptungen ohne Daten – wenn Quelle fehlt, steht dort ehrlich „keine Live-Bestätigung“.

## 7. Performance-Regeln

- Standardmäßig **kein** Auto-Loop, nur aktueller Frame
- Animation startet erst auf Play-Klick und lädt vorher die benötigten Frames vor (max 24 für RY, 24 für WN)
- Tiles werden gecached, Layerwechsel räumt alte Sources auf
- Map-Resize per ResizeObserver gedrosselt
- Blitz-WS pausiert bei Tab-Inaktivität (`document.visibilityState`)

## 8. Visuelle Sprache

- Bestehendes Cockpit-Farbset, keine neuen Akzentfarben
- Layer-Toolbar als nüchterne Icon-Buttons mit Label, aktiver Zustand = volle Fläche, inaktiv = nur Outline
- Warnpolygone dezent (1 px Stroke, 8 % Fill), Blitze als kleine, scharfe Symbole, keine Glow-Effekte
- Legende minimal: vier RY-Klassen, drei Blitz-Altersstufen, fertig

## 9. Dateien

**Neu:**
- `src/lib/weather/sources/dwd-wms.ts`
- `src/lib/weather/sources/blitzortung.ts`
- `src/lib/weather/analysis/radar-cockpit.ts`
- `src/components/radar/RadarCockpit.tsx` (Layout-Orchestrierung)
- `src/components/radar/LayerToolbar.tsx`
- `src/components/radar/TimeScrubber.tsx`
- `src/components/radar/ModeSwitch.tsx`
- `src/components/radar/AnalysisRail.tsx`
- `src/components/radar/LightningLayer.tsx`
- `src/components/radar/StationsLayer.tsx`

**Geändert:**
- `src/components/map/WeatherMap.tsx` → schlanke Map-Shell mit imperativen Layer-APIs
- `src/routes/map.tsx` → rendert nur noch `<RadarCockpit />`, eigene `head()`-Metadaten
- `src/components/cockpit/LiveSignals.tsx` → Map-Embed bleibt, nutzt die neue Map-Shell mit Standard-Layer RY
- `src/components/layout/AppShell.tsx` → Label „Karte“ → „Radar-Cockpit“

**Nicht angefasst:** alle Analyse-/Forecast-/Mapper-/Live-Module, alle übrigen Routen, Settings, Stationen, Modelle, Lernen, Alerts, Dashboard-Strukturen außer dem Map-Embed.

## 10. Out of scope

- Eigenes Tile-Hosting oder Proxy
- Kommerzielle Quellen (Meteomatics, MeteoGroup etc.)
- Push-Benachrichtigungen / Service Worker
- Mehrere parallele Karten / Split-View
