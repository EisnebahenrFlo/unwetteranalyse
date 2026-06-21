Hi Flo, hier mein Vorschlag für den Komplettumbau der UI/UX, ohne deine bestehenden Datenquellen, Queries und Analysefunktionen anzufassen. Nur Präsentation, Layout, Hierarchie und Navigation werden neu.

## Leitidee

Die App wird zu einem Analyse-Cockpit, das deiner Denkfolge folgt:
Lage → Gefahr → Kurzfrist → Live → Trend → System.
Keine Kartenwüste, klare Größenstufen, ruhige Optik, fachliche Färbung nur wo sie hilft.

## Neue Informationsarchitektur (Dashboard `/`)

Eine einzige scrollbare Hauptansicht mit Sprungankern und Sticky-Sub-Header. Anker-IDs: `lage`, `gefahren`, `nowcast`, `live`, `trend`, `system`.

```text
┌─ Header ─────────────────────────────────────────────────────────┐
│ MeteoFlo │ Ort / Suche (zentriert)            │ Status · Theme   │
├─ Sticky-Subnav ──────────────────────────────────────────────────┤
│ Lage · Gefahren · Nowcast · Live · Trend · System                │
├─ 1 Lage (primär, volle Breite) ──────────────────────────────────┤
│ Lage-Headline + Kernsatz + Lage-Score · Hauptgefahr · Fenster    │
├─ 2 Gefahren (sekundär, 2-spaltig auf Desktop) ───────────────────┤
│ Priorisierte Gefahrenliste (Starkregen, Gewitter, Wind, Hagel…)  │
├─ 3 Kurzfrist 0–2 h (sekundär) ───────────────────────────────────┤
│ Nowcast-Verlauf + Konvektions-Kontext + Tendenz-Pfeil            │
├─ 4 Live (sekundär, 12-col Grid) ─────────────────────────────────┤
│ Radar · Aktuelle Beobachtung · Wind/Böen · Druck/Tendenz         │
├─ 5 Trend 24 h / 7 d (tertiär, kompakt) ──────────────────────────┤
│ Hourly-Strip (kompakt) + Daily-Strip mit Gefahrenpillen          │
├─ 6 System (tertiär, kollabierbar) ───────────────────────────────┤
│ Quellen, letzte Aktualisierung, Verzögerungen, Unsicherheiten    │
└──────────────────────────────────────────────────────────────────┘
```

### 1. Lage (neu, `SituationHeadline`)
Eine einzige große Karte, kein Grid. Inhalte:
- Lage-Score 0–100 als großer Wert + Label (ruhig / erhöht / markant / unwetterartig)
- Ein klarer Kernsatz, generiert aus `situation.ts` und `hazards.ts` (z. B. „Konvektive Lage erhöht, Hauptfenster 16–20 Uhr, Starkregen führend.")
- Hauptgefahr als großer Chip
- Zeitfenster der Hauptphase
- Tendenz-Pfeil (verschärft / stabil / entspannt) auf Basis Nowcast-Slope

### 2. Gefahren (`HazardPriorityList`)
- Liste statt Kacheln, max. 6 Einträge, sortiert nach Severity × Confidence
- Pro Zeile: Icon, Name, Severity-Balken, Confidence (1–5), Kurzbewertung, Zeitfenster
- Heat/Cold/Frost klar abgesetzt, nicht als Unwetter
- Detail per Accordion (kein Modal), Rohwerte zweite Ebene

### 3. Kurzfrist 0–2 h (`ShortTermPanel`)
- Nutzt bestehende `NowcastPanel`-Logik in neuer, ruhigerer Darstellung
- Multimetrik-Strip 10-min: Severe, Regen mm/h, Böen, Konvektionsindex
- Tendenz-Badge oben rechts: verschärft / stabil / entspannt
- Konsistenz-Hinweis: Radar vs. Modell („konsistent" / „Radar voraus")

### 4. Live (`LiveSignals`, 12-col Grid)
- Radar (DWD) groß, 8 Spalten
- Rechts gestapelt: Aktuelle Bright-Sky-Beobachtung, Wind/Böen, Druck-Tendenz
- Klar getrennt von Bewertung durch eigene Sektion + Label „Beobachtung"

### 5. Trend (`TrendStrip`)
- Hourly-Strip kompakt, 24 h
- Daily-Strip 7 d mit Gefahren-Pille pro Tag (Severity-Farbe)
- Kein Hero-Status mehr, klar nachgelagert

### 6. System (`SystemStatus`, default kollabiert)
- Quellenliste mit Zeitstempel, Latenz, Status (ok / verzögert / aus)
- Hinweise zu Unsicherheiten (Modellspread, fehlende Stationen)
- Ersetzt das bisherige `DataMeta` verstreut auf der Seite

## Header & Navigation

- Header: Logo links · `LocationSwitcher` zentriert · rechts `SystemStatusPill` (grün/gelb/rot, klickbar → springt zu `#system`) + `ThemeToggle`
- Sticky Subnav mit 6 Ankern, scroll-spy aktiv, auf Mobile horizontal scrollbar mit Snap
- Seitenleiste auf Desktop bleibt erhalten, wird aber ruhiger: Primär = Dashboard, Karte, Analyse, Warnungen. „Mehr" wie heute. Sidebar-Active-Highlight subtiler.

## Sekundäre Routen

Werden visuell an die neue Sprache angeglichen, Struktur bleibt:
- `/analysis`, `/map`, `/alerts`, `/models`, `/stations`, `/learn`, `/settings`
- Gemeinsamer Section-Header (`SectionHeader` mit Titel + Kernfrage) auf allen Seiten

## Neue UI-Bausteine (rein präsentationell)

Neu in `src/components/cockpit/`:
- `SectionHeader.tsx` — Titel, Kernfrage, Anker-ID
- `StickySubnav.tsx` — Sprunganker mit Scroll-Spy
- `SituationHeadline.tsx` — Primärbereich Lage
- `HazardPriorityList.tsx` — priorisierte Gefahrenliste
- `ShortTermPanel.tsx` — Wrapper um bestehende Nowcast-Logik
- `LiveSignals.tsx` — Radar + Beobachtung + Wind + Druck
- `TrendStrip.tsx` — Wrapper um `HourlyStrip` + `DailyStrip`
- `SystemStatus.tsx` — Quellen/Status, kollabierbar
- `SystemStatusPill.tsx` — Header-Indikator
- `TendencyBadge.tsx` — verschärft / stabil / entspannt

Bestehende Komponenten bleiben als Datenlieferanten und werden intern weiterverwendet (`ThreatBoard`-Logik fliesst in `HazardPriorityList` + `ShortTermPanel` ein, `CurrentConditions` + `NextChange` werden Teil von `LiveSignals` bzw. `SituationHeadline`).

## Visuelle Sprache (`src/styles.css`)

- Hintergrund: ruhige, leicht kühle Neutraltöne, klarer Light/Dark-Mode
- Typo-Skala mit echten Größenstufen für Hero/Section/Body/Meta
- Severity-Skala bleibt, dekorative Farben raus
- Card-Stile: 3 Varianten via `tone`: `primary` (Lage), `default` (Sektionen), `muted` (System/Trend)
- Keine Glows, keine Hero-Gradients, dezente Borders, hoher Kontrast

## Was nicht angefasst wird

- Datenquellen, Queries, `analysis/*`, `sources/*`, `mappers/*`, `live.ts`, `hooks/*`
- Routenstruktur und Routenamen
- Bestehende Funktionalität von `NowcastPanel`, `ThreatBoard`, `SevereTimeline`, `WeatherMap`

## Umsetzungsschritte

1. Neue Cockpit-Komponenten anlegen (leere Hüllen, dann gefüllt)
2. `src/routes/index.tsx` auf neue Sektionsstruktur umstellen
3. `AppShell.tsx` Header anpassen (`SystemStatusPill` + Sticky-Subnav)
4. `styles.css` Tokens ruhiger und konsistenter
5. Sekundäre Routen mit `SectionHeader` vereinheitlichen
6. Mobile-Pass: Sticky-Subnav scrollbar, Sektionen volle Breite, BottomNav bleibt

Soll ich so loslegen, oder willst du vorher noch Reihenfolge, Sticky-Subnav oder die Sidebar-Logik anpassen?
