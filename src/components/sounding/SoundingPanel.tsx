import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { soundingQuery, buildSounding } from "@/lib/weather/queries";
import { SkewT } from "./SkewT";
import { Hodograph } from "./Hodograph";
import type { GeoPoint } from "@/lib/weather/types";

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
      <p className="text-[10px] text-muted-foreground">
        Thermo: Open-Meteo (ICON). Kinematik abgeleitet aus Drucklevel-Wind. Storm-Motion nach
        Bunkers-ID (RM/LM). Quelle: Open-Meteo / DWD ICON.
      </p>
    </div>
  );
}