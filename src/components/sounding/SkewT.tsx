import type { SoundingLevel } from "@/lib/weather/sounding/profile";

const P_BOT = 1050,
  P_TOP = 150;
const T_MIN = -40,
  T_MAX = 40;
const W = 320,
  H = 380,
  PAD_L = 34,
  PAD_R = 34,
  PAD_T = 12,
  PAD_B = 22;
const PW = W - PAD_L - PAD_R,
  PH = H - PAD_T - PAD_B;
const SKEW = 0.85;

const yOf = (p: number) =>
  PAD_T + (PH * (Math.log(P_BOT) - Math.log(p))) / (Math.log(P_BOT) - Math.log(P_TOP));
const xOf = (tC: number, p: number) => {
  const base = PAD_L + (PW * (tC - T_MIN)) / (T_MAX - T_MIN);
  return base + SKEW * (yOf(P_BOT) - yOf(p));
};

function barb(x: number, y: number, u: number, v: number): string {
  const sp = Math.hypot(u, v);
  if (sp < 0.5) return "";
  const ux = u / sp,
    uy = v / sp;
  const L = 16;
  const x2 = x - ux * L,
    y2 = y + uy * L;
  return `M ${x} ${y} L ${x2} ${y2}`;
}

export function SkewT({
  levels,
  lclAglM: _lclAglM,
}: {
  levels: SoundingLevel[];
  lclAglM?: number | null;
}) {
  void _lclAglM;
  const isotherms = [];
  for (let t = T_MIN; t <= T_MAX; t += 10) {
    isotherms.push(
      <line
        key={`iso${t}`}
        x1={xOf(t, P_BOT)}
        y1={yOf(P_BOT)}
        x2={xOf(t, P_TOP)}
        y2={yOf(P_TOP)}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={1}
      />,
    );
  }
  const pLines = [1000, 850, 700, 500, 300, 200, 150].map((p) => (
    <g key={`p${p}`}>
      <line
        x1={PAD_L}
        y1={yOf(p)}
        x2={W - PAD_R}
        y2={yOf(p)}
        stroke="currentColor"
        strokeOpacity={0.15}
      />
      <text x={4} y={yOf(p) + 3} fontSize={9} fill="currentColor" opacity={0.6}>
        {p}
      </text>
    </g>
  ));
  const tPath = levels
    .map((l, i) => `${i ? "L" : "M"} ${xOf(l.temperatureC, l.pressureHpa)} ${yOf(l.pressureHpa)}`)
    .join(" ");
  const dPath = levels
    .map((l, i) => `${i ? "L" : "M"} ${xOf(l.dewPointC, l.pressureHpa)} ${yOf(l.pressureHpa)}`)
    .join(" ");
  const barbX = W - PAD_R + 14;

  return (
    <svg
      viewBox={`0 0 ${W + 24} ${H}`}
      className="h-auto w-full text-foreground"
      role="img"
      aria-label="Skew-T Vertikalprofil"
    >
      {isotherms}
      {pLines}
      <path d={dPath} fill="none" stroke="var(--sounding-dew, #22c55e)" strokeWidth={2} />
      <path d={tPath} fill="none" stroke="var(--sounding-temp, #ef4444)" strokeWidth={2} />
      {levels.map((l) => {
        const d = barb(barbX, yOf(l.pressureHpa), l.windU, l.windV);
        return d ? (
          <path
            key={`b${l.pressureHpa}`}
            d={d}
            stroke="currentColor"
            strokeOpacity={0.7}
            strokeWidth={1.5}
          />
        ) : null;
      })}
      <text
        x={xOf(0, P_BOT)}
        y={H - 8}
        fontSize={9}
        fill="currentColor"
        opacity={0.6}
        textAnchor="middle"
      >
        0 °C
      </text>
    </svg>
  );
}