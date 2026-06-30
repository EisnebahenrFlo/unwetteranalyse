import { useMemo } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  X,
  Wind,
  Zap,
  Compass,
  Activity,
  Target,
  ShieldAlert,
  Route as RouteIcon,
} from "@/components/icons";
import type { StormCell, StormAlert } from "@/lib/weather/storm/types";
import type { HazardCellReport } from "@/lib/weather/hazards/types";
import { HazardCellSection } from "@/components/hazards/HazardCellSection";
import { StormTrackMini } from "./StormTrackMini";
import { SEVERITY_LABEL, SEVERITY_TONE } from "./severity-tokens";
import { SeverityRail, stormSeverityToLevel } from "@/components/common/SeverityRail";
import { cn } from "@/lib/utils";

interface Props {
  cell: StormCell | null;
  alerts: StormAlert[];
  hazardReport?: HazardCellReport | null;
  onClose: () => void;
}

export function StormCellDrawer({ cell, onClose, alerts, hazardReport = null }: Props) {
  const open = !!cell;

  const lifespanMin = useMemo(() => {
    if (!cell) return 0;
    return Math.round((cell.lastSeen - cell.firstSeen) / 60_000);
  }, [cell]);

  if (!cell) return null;
  const stufe = stormSeverityToLevel(cell.severity.level);

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DrawerContent className="flex max-h-[88vh] flex-col">
        <DrawerHeader className="shrink-0 text-left">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
            {stufe ? (
              <SeverityRail
                level={stufe}
                orientation="vertical"
                label={`S${stufe}`}
                className="mt-1 h-14"
              />
            ) : (
              <div className="w-2" />
            )}
            <div className="min-w-0">
              <DrawerTitle className="flex items-center gap-2 text-base">
                <span className="font-mono text-sm text-muted-foreground">{cell.id}</span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium",
                    SEVERITY_TONE[cell.severity.level],
                  )}
                >
                  {SEVERITY_LABEL[cell.severity.level]} · {cell.severity.score}
                </span>
              </DrawerTitle>
              <DrawerDescription className="text-xs">
                Lebensdauer {lifespanMin} min · {cell.centroid.lat.toFixed(3)},{" "}
                {cell.centroid.lon.toFixed(3)}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="grid min-h-0 gap-3 overflow-y-auto px-4 pb-6">
          <div className="grid grid-cols-3 gap-2">
            <KpiBox
              icon={Zap}
              label="Top-dBZ*"
              value={Math.round(cell.topDbz).toString()}
              sub={`Fläche ${Math.round(cell.areaKm2)} km²`}
            />
            <KpiBox
              icon={Wind}
              label="Bewegung"
              value={cell.motion ? `${Math.round(cell.motion.speedKmh)} km/h` : "—"}
              sub={cell.motion ? `nach ${cell.motion.bearingCompass}` : "zu wenig Historie"}
            />
            <KpiBox
              icon={Compass}
              label="Trend"
              value={cell.dbzTrend >= 0 ? `+${cell.dbzTrend.toFixed(0)} dBZ` : `${cell.dbzTrend.toFixed(0)} dBZ`}
              sub={
                cell.dbzTrend >= 3
                  ? "verstärkt sich"
                  : cell.dbzTrend <= -3
                    ? "schwächt ab"
                    : "stabil"
              }
            />
          </div>

          {cell.hailCoreAreaKm2 >= 1 && (
            <div className="rounded-lg border border-warn-severe/40 bg-warn-severe/10 px-3 py-2 text-xs">
              <span className="font-semibold text-warn-severe">
                Hagelkern erkannt
              </span>{" "}
              <span className="text-muted-foreground">
                {cell.hailCoreAreaKm2.toFixed(0)} km² (Konvektionskern, Stufe ≥5 ≈ 48 dBZ abgeleitet)
              </span>
            </div>
          )}

          <Section title="Zugbahn" icon={RouteIcon}>
            <StormTrackMini cell={cell} />
          </Section>

          <Section title="Severity-Begründung" icon={Activity}>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {cell.severity.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Section>

          {hazardReport && (
            <Section title="Hazards" icon={ShieldAlert}>
              <HazardCellSection report={hazardReport} />
            </Section>
          )}

          {cell.forecast.length > 0 && (
            <Section title="Forecast" icon={Compass}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-1 pr-3 font-normal">Offset</th>
                      <th className="py-1 pr-3 font-normal">Position</th>
                      <th className="py-1 font-normal">Cone</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {cell.forecast
                      .filter((f) => f.offsetMin % 15 === 0 || f.offsetMin === 5)
                      .map((f) => (
                        <tr key={f.offsetMin} className="border-t border-border/40">
                          <td className="py-1 pr-3">+{f.offsetMin} min</td>
                          <td className="py-1 pr-3">
                            {f.lat.toFixed(2)}, {f.lon.toFixed(2)}
                          </td>
                          <td className="py-1">±{Math.round(f.sigmaKm)} km</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {alerts.length > 0 && (
            <Section title="Betroffene Favoriten" icon={Target}>
              <ul className="space-y-1.5">
                {alerts.map((a) => (
                  <li
                    key={a.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs"
                  >
                    <span className="truncate font-medium">{a.favoriteName}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {a.etaMin === 0 ? "jetzt" : `+${a.etaMin} min`} · {a.distanceKm.toFixed(0)} km
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <p className="text-[10px] text-muted-foreground">
            * Detection aus DWD-RY (Niederschlagsrate, Farbskala-Näherung); dBZ* abgeleitet via
            Z-R (Aniol). Tracking per Centroid-Matching zwischen Frames. Severity nutzt CAPE/LI und
            Windböen am Zellort; Forecast linear extrapoliert mit Cone-Aufweitung √t.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function KpiBox({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 font-mono text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="flex items-center gap-1.5 border-b border-border/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}