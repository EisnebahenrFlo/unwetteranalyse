# Fix: Severity-Mapping + amtliche DWD-Warnstufen

Zwei Bugs, beide fachlich relevant.

## A — Severity immer „minor"
`mapBrightSkyAlerts` liest `a.level` (existiert in der Bright-Sky-Antwort nicht). Das CAP-Feld ist der String `severity` (`minor|moderate|severe|extreme`). Folge: alle Warnungen landen auf `minor`.

## B — Falsche Stufen-Namen im `WarnBadge`
Aktuell: `minor=„Markant"`, `moderate=„Unwetter"`. Amtlich (DWD):
- Stufe 1 = Wetterwarnung (Gelb)
- Stufe 2 = Markantes Wetter (Orange)
- Stufe 3 = Unwetterwarnung (Rot)
- Stufe 4 = Extremes Unwetter (Violett)

Alles ist um eine Stufe verschoben.

## Änderungen

### 1) Neu: `src/lib/weather/thresholds/warn-level.ts`
Kanonische DWD-Stufen 1–4 plus Mapper:
- `WARN_LEVEL` (Name + Farbe je Stufe)
- `capSeverityToLevel(s)` und `capSeverityToAlert(s)` für den CAP-String
- `severityToLevel(s)` für interne `AlertSeverity`

### 2) `src/lib/weather/types.ts`
Feld `warnLevel: 1 | 2 | 3 | 4` zu `WeatherAlert` ergänzen (optional, damit bestehende Stellen nicht brechen — wird in Mapper gesetzt).

### 3) `src/lib/weather/mappers/bright-sky.ts`
- Alte `mapSeverity(level)`-Funktion löschen.
- `mapBrightSkyAlerts` benutzt `capSeverityToAlert(a.severity)` und setzt `warnLevel: capSeverityToLevel(a.severity)`.
- `level?: number` aus dem Input-Typ entfernen.

### 4) `src/components/common/WarnBadge.tsx`
- Hardcoded `LABEL`-Map ersetzen durch Lookup über `severityToLevel` + `WARN_LEVEL.name`.
- Neue Prop `showLevel?: boolean` zeigt zusätzlich „Stufe X · Name".
- Bestehende Aufrufer bleiben kompatibel (keine API-Bruch).

### 5) Amtlich vs. eigene Analyse
- `src/routes/alerts.tsx`: bei der amtlichen Liste `<WarnBadge severity={a.severity} showLevel />` setzen.
- Bei der eigenen Schwellen-/Modell-Analyse (`SevereOverview`, `ThreatBoard`, `NowcastPanel`, `ModelSeverityGrid`, etc.) **kein** `showLevel` — diese Badges bleiben Worte ohne „Stufe X", weil sie keine amtliche Einstufung sind.

## Technische Details

- `warnLevel` als optional typisieren, damit nicht jedes Mock/Test-Objekt brechen muss.
- `AlertSeverity` bleibt unverändert (`minor|moderate|severe|extreme`).
- Mapping bleibt CAP-konform: minor=1, moderate=2, severe=3, extreme=4. Verfeinerung per `event_code` ist später möglich, aktuell out of scope.

## Nicht im Scope

- Andere Mapper (Open-Meteo, DWD) — die liefern aktuell keine Alerts via diesen Pfad.
- Refactor der eigenen Schwellen-Analyse-Komponenten (nur Beschriftung wird über `showLevel` gesteuert).
