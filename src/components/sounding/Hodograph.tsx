import type { SoundingLevel, SoundingKinematics } from "@/lib/weather/sounding/profile";

const S = 240,
  C = S / 2,
  MAXMS = 40,
  R = (C - 16) / MAXMS;
const px = (u: number) => C + u * R;
const py = (v: number) => C - v * R;

function bandColor(hAgl: number): string {
  if (hAgl <= 1000) return "#ef4444";
  if (hAgl <= 3000) return "#f59e0b";
  if (hAgl <= 6000) return "#22c55e";
  return "#3b82f6";
}

export function Hodograph({
  levels,
  kin,
}: {
  levels: SoundingLevel[];
  kin: SoundingKinematics | null;
}) {
  const pts = levels.filter((l) => l.heightAglM <= 9000);
  const rings = [10, 20, 30, 40].map((r) => (
    <circle key={r} cx={C} cy={C} r={r * R} fill="none" stroke="currentColor" strokeOpacity={0.15} />
  ));
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    segs.push(
      <line
        key={i}
        x1={px(a.windU)}
        y1={py(a.windV)}
        x2={px(b.windU)}
        y2={py(b.windV)}
        stroke={bandColor(b.heightAglM)}
        strokeWidth={2.5}
      />,
    );
  }
  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className="h-auto w-full text-foreground"
      role="img"
      aria-label="Hodograph"
    >
      <line x1={C} y1={16} x2={C} y2={S - 16} stroke="currentColor" strokeOpacity={0.15} />
      <line x1={16} y1={C} x2={S - 16} y2={C} stroke="currentColor" strokeOpacity={0.15} />
      {rings}
      {segs}
      {kin && (
        <>
          <circle
            cx={px(kin.stormRight.u)}
            cy={py(kin.stormRight.v)}
            r={4}
            fill="var(--sounding-temp, #ef4444)"
          />
          <text
            x={px(kin.stormRight.u) + 6}
            y={py(kin.stormRight.v) + 3}
            fontSize={9}
            fill="currentColor"
          >
            RM
          </text>
          <circle
            cx={px(kin.stormLeft.u)}
            cy={py(kin.stormLeft.v)}
            r={3}
            fill="currentColor"
            opacity={0.5}
          />
          <text
            x={px(kin.stormLeft.u) + 6}
            y={py(kin.stormLeft.v) + 3}
            fontSize={9}
            fill="currentColor"
            opacity={0.6}
          >
            LM
          </text>
        </>
      )}
    </svg>
  );
}