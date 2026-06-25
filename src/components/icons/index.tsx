import type { ReactNode, SVGProps } from "react";
import { MeteoconIcon } from "@/components/weather/MeteoconIcon";

/**
 * Eigenes Icon-Set – ein konsistenter, ruhiger Strich-Stil
 * (currentColor, runde Enden, 1.75 Strichbreite). Wetter-/Mess-Icons
 * sind echte Meteocons; Glyph-Icons sind eigene SVGs.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

type Builder = (props: IconProps) => ReactNode;

function svg(
  paths: ReactNode,
  opts: { fill?: string; strokeWidth?: number; viewBox?: string } = {},
): Builder {
  const Comp = ({ size = 24, className, strokeWidth, ...rest }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox={opts.viewBox ?? "0 0 24 24"}
      fill={opts.fill ?? "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth ?? opts.strokeWidth ?? 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...rest}
    >
      {paths}
    </svg>
  );
  return Comp;
}

/* --------------------------- Meteocon-Wrapper --------------------------- */

type WeatherProps = { className?: string };
const mc =
  (name: "thermometer" | "windsock" | "raindrop" | "barometer" | "compass" | "hail") =>
  ({ className }: WeatherProps) => <MeteoconIcon name={name} className={className} />;

export const Thermometer = mc("thermometer");
export const Wind = mc("windsock");
export const CloudRain = mc("raindrop");
export const CloudHail = mc("hail");
export const Gauge = mc("barometer");
export const Compass = mc("compass");

/* --------------------------- Warn-Glyph --------------------------- */

export const AlertTriangle = ({ size = 24, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="hsl(var(--warn-severe) / 0.18)"
    stroke="hsl(var(--warn-severe))"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={className}
    {...rest}
  >
    <path d="M12 3.2 21.4 19.4a1.4 1.4 0 0 1 -1.2 2.1H3.8a1.4 1.4 0 0 1 -1.2 -2.1z" />
    <path d="M12 10v4.5" stroke="currentColor" />
    <circle cx="12" cy="17.6" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

/* --------------------------- Nav-Glyphen --------------------------- */

export const Map = svg(
  <>
    <path d="M3 6.2 9 4l6 2 6-2v13.8L15 20 9 18 3 20z" fill="currentColor" fillOpacity="0.12" />
    <path d="M9 4v14" />
    <path d="M15 6v14" />
  </>,
);

export const LineChart = svg(
  <>
    <path d="M4 4v15a1 1 0 0 0 1 1h15" />
    <path d="M7 15l4-5 3 3 5-7" />
    <path
      d="M7 15l4-5 3 3 5-7 L19 20 L7 20z"
      fill="currentColor"
      fillOpacity="0.10"
      stroke="none"
    />
  </>,
);

export const Layers = svg(
  <>
    <path d="M12 3 21 8 12 13 3 8z" fill="currentColor" fillOpacity="0.15" />
    <path d="M3 12.5 12 17.5 21 12.5" />
    <path d="M3 17 12 22 21 17" />
  </>,
);

export const Radio = svg(
  <>
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    <path d="M8.5 8.5a5 5 0 0 0 0 7" />
    <path d="M15.5 15.5a5 5 0 0 0 0-7" />
    <path d="M5.5 5.5a9 9 0 0 0 0 13" />
    <path d="M18.5 18.5a9 9 0 0 0 0-13" />
  </>,
);

export const GraduationCap = svg(
  <>
    <path d="M2 9 12 4l10 5-10 5z" fill="currentColor" fillOpacity="0.15" />
    <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
    <path d="M22 9v5" />
  </>,
);

export const Settings = svg(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1 -2.8 2.8l-.1-.1a1.7 1.7 0 0 0 -1.9-.3 1.7 1.7 0 0 0 -1 1.5V21a2 2 0 1 1 -4 0v-.1a1.7 1.7 0 0 0 -1.1-1.5 1.7 1.7 0 0 0 -1.9.3l-.1.1a2 2 0 1 1 -2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0 -1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0 -.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 -.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0 -1.5 1z" />
  </>,
);

export const MoreHorizontal = svg(
  <>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </>,
);

/* --------------------------- Chevrons & Arrows --------------------------- */

export const ChevronDown = svg(<path d="M6 9l6 6 6-6" />);
export const ChevronUp = svg(<path d="M6 15l6-6 6 6" />);
export const ChevronLeft = svg(<path d="M15 6l-6 6 6 6" />);
export const ChevronRight = svg(<path d="M9 6l6 6-6 6" />);
export const ChevronDownIcon = ChevronDown;
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRightIcon = ChevronRight;

export const ArrowLeft = svg(
  <>
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </>,
);
export const ArrowRight = svg(
  <>
    <path d="M5 12h14" />
    <path d="M12 5l7 7-7 7" />
  </>,
);
export const ArrowUp = svg(
  <>
    <path d="M12 19V5" />
    <path d="M5 12l7-7 7 7" />
  </>,
);
export const ArrowDown = svg(
  <>
    <path d="M12 5v14" />
    <path d="M19 12l-7 7-7-7" />
  </>,
);
export const ArrowUpRight = svg(
  <>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </>,
);
export const ArrowDownRight = svg(
  <>
    <path d="M7 7l10 10" />
    <path d="M17 8v9H8" />
  </>,
);
export const MoveUpRight = svg(
  <>
    <path d="M13 5h6v6" />
    <path d="M19 5L5 19" />
  </>,
);

/* --------------------------- Allgemeine UI --------------------------- */

export const X = svg(
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </>,
);
export const Check = svg(<path d="M4 12l5 5 11-11" />);
export const Circle = svg(<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />);
export const Minus = svg(<path d="M5 12h14" />);
export const Search = svg(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M20.5 20.5l-4.3-4.3" />
  </>,
);
export const MapPin = svg(
  <>
    <path
      d="M12 22s7-6.5 7-12a7 7 0 1 0 -14 0c0 5.5 7 12 7 12z"
      fill="currentColor"
      fillOpacity="0.12"
    />
    <circle cx="12" cy="10" r="2.5" />
  </>,
);
export const Star = svg(
  <path
    d="M12 3.5 14.5 9l5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"
    fill="currentColor"
    fillOpacity="0.18"
  />,
);
export const Info = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
  </>,
);
export const Inbox = svg(
  <>
    <path d="M3 12h5l2 3h4l2-3h5" />
    <path d="M5 12 6.7 5.5A2 2 0 0 1 8.6 4h6.8a2 2 0 0 1 1.9 1.5L19 12v6a2 2 0 0 1 -2 2H7a2 2 0 0 1 -2 -2z" />
  </>,
);
export const GripVertical = svg(
  <>
    <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </>,
);
export const PanelLeft = svg(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M9 4v16" />
  </>,
);
export const Loader2 = ({ size = 24, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={className}
    {...rest}
  >
    <path d="M21 12a9 9 0 1 1 -6.2 -8.55" />
  </svg>
);
export const Crosshair = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v4" />
    <path d="M12 17v4" />
    <path d="M3 12h4" />
    <path d="M17 12h4" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </>,
);
export const Trash2 = svg(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>,
);

/* --------------------------- Theme --------------------------- */

export const Moon = svg(
  <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" fill="currentColor" fillOpacity="0.15" />,
);
export const Sun = svg(
  <>
    <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.18" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="M4.9 4.9l1.4 1.4" />
    <path d="M17.7 17.7l1.4 1.4" />
    <path d="M4.9 19.1l1.4-1.4" />
    <path d="M17.7 6.3l1.4-1.4" />
  </>,
);
export const Monitor = svg(
  <>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 21h8" />
    <path d="M12 17v4" />
  </>,
);

/* --------------------------- Shield / Status --------------------------- */

const shieldPath = "M12 3 4 6v6c0 4.4 3.4 7.9 8 9 4.6-1.1 8-4.6 8-9V6z";
export const ShieldCheck = svg(
  <>
    <path d={shieldPath} fill="currentColor" fillOpacity="0.12" />
    <path d="M8.5 12l2.5 2.5L15.5 10" />
  </>,
);
export const ShieldAlert = svg(
  <>
    <path d={shieldPath} fill="currentColor" fillOpacity="0.12" />
    <path d="M12 8v4.5" />
    <circle cx="12" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
  </>,
);

/* --------------------------- Player / Action --------------------------- */

export const Pause = svg(
  <>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </>,
);
export const Play = svg(<path d="M7 5v14l12-7z" fill="currentColor" fillOpacity="0.2" />);
export const SkipBack = svg(
  <>
    <path d="M19 5L9 12l10 7z" fill="currentColor" fillOpacity="0.18" />
    <path d="M5 5v14" />
  </>,
);
export const SkipForward = svg(
  <>
    <path d="M5 5l10 7-10 7z" fill="currentColor" fillOpacity="0.18" />
    <path d="M19 5v14" />
  </>,
);

/* --------------------------- Weitere --------------------------- */

export const Zap = svg(
  <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" fillOpacity="0.18" />,
);
export const Radar = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 12 19 8" />
    <path d="M12 12a9 9 0 0 0 9 0" fill="currentColor" fillOpacity="0.12" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </>,
);
export const Globe2 = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18" />
    <path d="M12 3a14 14 0 0 0 0 18" />
  </>,
);
export const Activity = svg(<path d="M3 12h4l3-7 4 14 3-7h4" />);
export const Target = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </>,
);
export const Route = svg(
  <>
    <circle cx="6" cy="19" r="2.5" />
    <circle cx="18" cy="5" r="2.5" />
    <path d="M8.5 19H15a3 3 0 0 0 0-6h-6a3 3 0 0 1 0-6h6.5" />
  </>,
);
export const CheckCircle2 = svg(
  <>
    <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.12" />
    <path d="M8 12l3 3 5-6" />
  </>,
);
export const CircleHelp = svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7" />
    <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
  </>,
);
export const Droplets = svg(
  <>
    <path
      d="M7 14a4 4 0 1 0 8 0c0-2.5-4-6-4-6s-4 3.5-4 6z"
      fill="currentColor"
      fillOpacity="0.18"
    />
    <path d="M14.5 9.5c.9-1.3 2.5-3 2.5-3s4 3.5 4 6a4 4 0 0 1 -6.5 3.2" />
  </>,
);
export const Flame = svg(
  <path
    d="M12 2s4 5 4 9a4 4 0 0 1 -8 0c0-1.5 1-2.5 1-4 0 1.5 1 2 2 2 0-3 1-7 1-7z"
    fill="currentColor"
    fillOpacity="0.18"
  />,
);
export const AlertOctagon = svg(
  <>
    <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" fill="currentColor" fillOpacity="0.12" />
    <path d="M12 8v5" />
    <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none" />
  </>,
);
export const AlertCircle = svg(
  <>
    <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.12" />
    <path d="M12 8v5" />
    <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none" />
  </>,
);
