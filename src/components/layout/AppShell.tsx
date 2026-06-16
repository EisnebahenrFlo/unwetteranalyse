import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Cloud, CloudRain, Layers, AlertTriangle, Radio, LineChart, GraduationCap, Settings, Map, Compass } from "lucide-react";
import { LocationSwitcher } from "./LocationSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: Compass },
  { to: "/map", label: "Karte", icon: Map },
  { to: "/models", label: "Modelle", icon: Layers },
  { to: "/alerts", label: "Warnungen", icon: AlertTriangle },
  { to: "/stations", label: "Stationen", icon: Radio },
  { to: "/analysis", label: "Analyse", icon: LineChart },
  { to: "/learn", label: "Lernen", icon: GraduationCap },
  { to: "/settings", label: "Einstellungen", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 md:px-6">
          <Link to="/" search={keepSearch} className="flex shrink-0 items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Cloud className="h-4 w-4" />
            </div>
            <div className="hidden md:block">
              <div className="text-sm font-semibold tracking-tight">MeteoFlo</div>
              <div className="text-[10px] text-muted-foreground">Privates Wetterwerkzeug</div>
            </div>
          </Link>
          <div className="min-w-0">
            <LocationSwitcher />
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <SideNav />
        <main className="min-w-0 flex-1 px-3 pb-24 pt-4 md:px-6 md:pb-8 md:pt-6">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}

function SideNav() {
  return (
    <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-56 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground md:block">
      <nav className="flex flex-col gap-0.5 p-3">
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 text-[10px] leading-relaxed text-muted-foreground">
        Daten: Open-Meteo, Bright Sky / DWD, RainViewer. Privat, ohne Login.
      </div>
    </aside>
  );
}

function NavItem({ to, label, icon: Icon }: (typeof NAV)[number]) {
  return (
    <Link
      to={to}
      search={keepSearch}
      activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
      inactiveProps={{ className: "text-sidebar-foreground/80 hover:bg-sidebar-accent/60" }}
      activeOptions={{ exact: to === "/" }}
      className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors")}
      preload="intent"
    >
      <Icon className="h-4 w-4" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function BottomNav() {
  const mobileItems = NAV.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden">
      {mobileItems.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          search={keepSearch}
          activeProps={{ className: "text-primary" }}
          inactiveProps={{ className: "text-muted-foreground" }}
          activeOptions={{ exact: to === "/" }}
          className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium"
        >
          <Icon className="h-4 w-4" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Behält aktive Search-Params (lat/lon/name) beim Navigieren zwischen Tabs. */
const keepSearch = (prev: Record<string, unknown>) => prev;
