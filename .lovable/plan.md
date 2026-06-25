## Ziel
Eine gemeinsame Anzeige-Währung `DisplayLevel = 0|1|2|3|4` (DWD-Stufen, 0 = keine Warnung). `AlertSeverity`, `StormSeverity`, `HazardLevel` mappen verlustfrei darauf. `StormSeverity` kann jetzt `extreme` (Stufe 4) ausdrücken, aber nur mit Umgebungs-Stütze (CAPE/LI).

## Änderungen

### 1) `src/lib/weather/thresholds/warn-level.ts`
- Neuer Typ `export type DisplayLevel = 0 | WarnLevel`.
- Neuer Export `WARN_DISPLAY: Record<DisplayLevel, { name; color }>` — übernimmt 1–4 aus `WARN_LEVEL`, ergänzt `0: { name: "keine Warnung", color: "Grün" }`.
- Bestehende Exporte unverändert.

### 2) `src/lib/weather/storm/types.ts`
- `StormSeverity` um `"extreme"` erweitern.
- `SEVERITY_RANK.extreme = 4`.
- `DEFAULT_STORM_THRESHOLDS` unverändert.

### 3) `src/lib/weather/storm/severity.ts`
- Nach Stufenbestimmung Extrem-Block:
  - `scoreGate = env.source === "region" ? 85 : 80`.
  - Stütze: `cape >= 2500` ODER `liftedIndex <= -8`.
  - Bei `score >= scoreGate` und Stütze → `level = "extreme"` + Reason `"Stufe 4: extrem labile Umgebung (CAPE …/LI …, lokal|Region)"`.
  - Ohne CAPE/LI: Deckel bei `severe`.
- Neuer Export `stormToLevel(s: StormSeverity): DisplayLevel` mit `import type { DisplayLevel } from "../thresholds/warn-level"`.

### 4) `src/components/storm/severity-tokens.ts`
- `extreme` in allen vier Records:
  - `SEVERITY_COLOR.extreme = "#7c3aed"`.
  - `SEVERITY_LABEL.extreme = "extrem"`.
  - `SEVERITY_BADGE.extreme = "EXTREM"`.
  - `SEVERITY_TONE.extreme = "bg-violet-500/15 text-violet-700 dark:text-violet-300"`.

### 5) `src/lib/weather/hazards/types.ts`
- `hazardToLevel(l: HazardLevel): DisplayLevel` mit `import type { DisplayLevel } from "../thresholds/warn-level"`.

### 6) Anzeige-Konsistenz
- `src/components/storm/StormAlertBanner.tsx`: `extreme`-Arm vor `severe` ergänzen → violett (`border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300`).
- `src/components/radar/RadarMap.tsx` (Label-Textfarbe): `textColor: level === "severe" || level === "extreme" ? "#7f1d1d" : "#0f172a"`.

## Nicht im Scope
- `StormAlertLevel`-Default in `settings.ts`.
- Scherung/Helicity als Extrem-Zutat (nicht in `StormEnvironment`).
- Refactor der `scoreCell`-Grundformel.

## Risiken
- `StormSeverity`-Union: nach Apply `tsgo` laufen lassen, falls weitere `Record<StormSeverity, …>` existieren.
- Mapper als reine Funktionen mit `import type` → keine Laufzeit-Zyklen.

## Testfälle
1. Hohe Blitzrate ohne CAPE/LI → max. `severe`.
2. `score ≥ 80` + `cape ≥ 2500`, `source = "cell"` → `extreme` mit Begründung.
3. Gleiche Werte mit `source = "region"` + `score 80–84` → bleibt `severe` (Gate 85).
4. `WarnBadge` Stufe 3 und Storm-Badge `UNWETTER` identisches Rot.
5. Favorit im Pfad einer Stufe-4-Zelle → `StormAlertBanner` violett, nicht amber.
