import { useMemo, useState } from "react";
import { Zap, Target, ChevronRight, Activity } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { StormCell, StormAlert } from "@/lib/weather/storm/types";
import type { HazardCellReport } from "@/lib/weather/hazards/types";
import { SEVERITY_COLOR, SEVERITY_LABEL, SEVERITY_TONE } from "./severity-tokens";
import { StormCellDrawer } from "./StormCellDrawer";

interface Props {
  cells: StormCell[];
  alerts: StormAlert[];
  activeEta: { cell: StormCell; etaMin: number; distanceKm: number } | null;
  snapshotOk: boolean;
  hazardReports?: HazardCellReport[];
}

export function StormPanel({ cells, alerts, activeEta, snapshotOk, hazardReports = [] }: Props) {
  const [selected, setSelected] = useState<StormCell | null>(null);

  const grouped = useMemo(() => {
    const byCell = new Map<string, StormAlert[]>();
    for (const a of alerts) {
      const arr = byCell.get(a.cellId) ?? [];
      arr.push(a);
      byCell.set(a.cellId, arr);
    }
    return byCell;
  }, [alerts]);

  const hazardByCell = useMemo(() => {
    const m = new Map<string, HazardCellReport>();
    for (const r of hazardReports) m.set(r.cellId, r);
    return m;
  }, [hazardReports]);

  return (
    <section className="rounded-xl border border-border/60 bg-card/75 shadow-elegant backdrop-blur-xl">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="truncate text-sm font-semibold tracking-tight">Stormtracking</h2>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {cells.length} {cells.length === 1 ? "Zelle" : "Zellen"}
        </span>
      </header>

      {activeEta && <ActiveEtaRow eta={activeEta} onOpen={() => setSelected(activeEta.cell)} />}

      {cells.length === 0 ? (
        <EmptyState snapshotOk={snapshotOk} />
      ) : (
        <ul className="divide-y divide-border/50">
          {cells.map((cell) => (
            <CellRow
              key={cell.id}
              cell={cell}
              alerts={grouped.get(cell.id) ?? []}
              onOpen={() => setSelected(cell)}
            />
          ))}
        </ul>
      )}

      <StormCellDrawer
        cell={selected}
        onClose={() => setSelected(null)}
        alerts={selected ? (grouped.get(selected.id) ?? []) : []}
        hazardReport={selected ? (hazardByCell.get(selected.id) ?? null) : null}
      />
    </section>
  );
}

function ActiveEtaRow({
  eta,
  onOpen,
}: {
  eta: { cell: StormCell; etaMin: number; distanceKm: number };
  onOpen: () => void;
}) {
  const tone = SEVERITY_TONE[eta.cell.severity.level];
  const label = eta.etaMin === 0 ? "trifft jetzt" : `ETA ${eta.etaMin} min`;
  return (
    <button
      onClick={onOpen}
      className={cn(
        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/60 px-3 py-2 text-left text-xs",
        tone,
      )}
    >
      <Target className="h-3.5 w-3.5" />
      <div className="min-w-0">
        <div className="truncate font-semibold">
          {eta.cell.id} · {label}
        </div>
        <div className="truncate opacity-80">
          {eta.distanceKm.toFixed(0)} km · {SEVERITY_LABEL[eta.cell.severity.level]}
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 opacity-70" />
    </button>
  );
}

function CellRow({
  cell,
  alerts,
  onOpen,
}: {
  cell: StormCell;
  alerts: StormAlert[];
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        onClick={onOpen}
        className="grid w-full grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: SEVERITY_COLOR[cell.severity.level] }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
            <span className="font-mono text-xs text-muted-foreground">{cell.id}</span>
            <span>
              {SEVERITY_LABEL[cell.severity.level]} · Score {cell.severity.score}
            </span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {Math.round(cell.topDbz)} dBZ · {Math.round(cell.areaKm2)} km²
            {cell.motion && cell.motion.speedKmh > 1 && (
              <>
                {" "}
                · {Math.round(cell.motion.speedKmh)} km/h {cell.motion.bearingCompass}
              </>
            )}
          </div>
          {alerts.length > 0 && (
            <div className="mt-1 truncate text-[11px] font-medium text-foreground">
              {alerts
                .slice(0, 2)
                .map((a) => `${a.favoriteName} +${a.etaMin}min`)
                .join(" · ")}
              {alerts.length > 2 && ` · +${alerts.length - 2}`}
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </li>
  );
}

function EmptyState({ snapshotOk }: { snapshotOk: boolean }) {
  return (
    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
      <Activity className="mx-auto mb-2 h-5 w-5 opacity-50" />
      {snapshotOk ? (
        <>
          Keine konvektiven Zellen erkannt.
          <br />
          Bei aufkommendem Niederschlag erscheinen Tracks hier.
        </>
      ) : (
        <>
          Radar-Snapshot lädt oder ist nicht erreichbar.
          <br />
          Aktualisiert sich automatisch.
        </>
      )}
    </div>
  );
}