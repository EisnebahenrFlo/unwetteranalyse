import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { soundingQuery, buildSounding } from "@/lib/weather/queries";
import { SkewT } from "./SkewT";
import { Hodograph } from "./Hodograph";
import type { GeoPoint } from "@/lib/weather/types";
import { computeComposites, scpLevel, stpLevel } from "@/lib/weather/sounding/composites";

function fmt(n: number | null | undefined, unit: string, digits = 0) {
  return n == null ? "–" : `${n.toFixed(digits)} ${unit}`;
}

export function SoundingPanel({ point, hourIndex = 0 }: { point: GeoPoint; hourIndex?: number }) {
  const { data, isLoading, isError } = useQuery(soundingQuery(point));
  const profile = useMemo(() => (data ? buildSounding(data, hourIndex) : null), [data, hourIndex]);

  if (isLoading)
    return <div className="p-4 text-sm text-muted-foreground">Profil wird geladen…</div>;
  if (isError || !profile)
    return <div className="p-4 text-sm text-muted-foreground">Kein Vertikalprofil verfügbar.</div>;

  const k = profile.kinematics;
  const comp = computeComposites(profile);
  const levelClass = (l: "neutral" | "erhoeht" | "hoch") =>
    l === "hoch" ? "text-foreground font-semibold" : l === "erhoeht" ? "text-foreground" : "text-muted-foreground";
  const composites: Array<[string, string, string]> = [
    ["SCP", comp.scp == null ? "–" : comp.scp.toFixed(1), levelClass(scpLevel(comp.scp))],
    ["STP", comp.stp == null ? "–" : comp.stp.toFixed(1), levelClass(stpLevel(comp.stp))],
    ["EHI 0–3", comp.ehi03 == null ? "–" : comp.ehi03.toFixed(1), levelClass("neutral")],
    ["EHI 0–1", comp.ehi01 == null ? "–" : comp.ehi01.toFixed(1), levelClass("neutral")],
  ];
  const stats: Array<[string, string]> = [
    ["CAPE", fmt(profile.cape, "J/kg")],
    ["CIN", fmt(profile.cin, "J/kg")],
    ["LI", fmt(profile.liftedIndex, "K", 1)],
    ["LCL", fmt(profile.lclHeightAglM, "m")],
    ["Shear 0–6", fmt(k?.shear06Ms, "m/s", 1)],
    ["Shear 0–1", fmt(k?.shear01Ms, "m/s", 1)],
    ["SRH 0–3", fmt(k?.srh03, "m²/s²")],
    ["SRH 0–1", fmt(k?.srh01, "m²/s²")],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-2">
          <SkewT levels={profile.levels} lclAglM={profile.lclHeightAglM} />
        </div>
        <div className="rounded-lg border p-2">
          <Hodograph levels={profile.levels} kin={k} />
        </div>
      </div>
      <dl className="grid grid-cols-4 gap-x-3 gap-y-1 text-xs">
        {stats.map(([label, val]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono tabular-nums">{val}</dd>
          </div>
        ))}
      </dl>
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Composite</div>
        <dl className="grid grid-cols-4 gap-x-3 gap-y-1 text-xs">
          {composites.map(([label, val, cls]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={`font-mono tabular-nums ${cls}`}>{val}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Thermo: Open-Meteo (ICON). Kinematik aus Drucklevel-Wind. Storm-Motion nach Bunkers-ID.
        SCP/STP als Fixed-Layer-Näherung, US/SPC-kalibriert — in Mitteleuropa als Orientierung.
        Quelle: Open-Meteo / DWD ICON.
      </p>
    </div>
  );
}