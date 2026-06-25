import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Layers,
  AlertTriangle,
  Radio,
  LineChart,
  GraduationCap,
  Settings,
  Map,
  Compass,
  MoreHorizontal,
} from "@/components/icons";
import type { ComponentType } from "react";
import { LocationSwitcher } from "./LocationSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { MeteoconIcon } from "@/components/weather/MeteoconIcon";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Primärnavigation: bewusst auf 5 Top-Punkte verschlankt.
 * `Modelle` und `Stationen` sind als Sub-Themen im Analyse-Tab erreichbar,
 * eigene Routen bleiben für Direktlinks erhalten und liegen unter „Mehr".
 */
const PRIMARY_NAV = [
  { to: "/", label: "Dashboard", icon: Compass },
  { to: "/map", label: "Radar", icon: Map },
  { to: "/analysis", label: "Analyse", icon: LineChart },
  { to: "/alerts", label: "Warnungen", icon: AlertTriangle },
] as const;

const SECONDARY_NAV = [
  { to: "/models", label: "Modelle", icon: Layers },
  { to: "/stations", label: "Stationen", icon: Radio },
  { to: "/learn", label: "Lernen", icon: GraduationCap },
  { to: "/settings", label: "Einstellungen", icon: Settings },
] as const;

type NavItemDef = { to: string; label: string; icon: ComponentType<{ className?: string }> };

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 md:gap-3 md:px-6 md:py-2.5">
          <Link to="/" search={keepSearch} className="flex shrink-0 items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <MeteoconIcon name="partly-cloudy-day" label="ForecastHub" className="h-7 w-7" />
            </div>
            <div className="hidden md:block">
              <div className="text-sm font-semibold tracking-tight">ForecastHub</div>
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
        <main className="min-w-0 flex-1 px-3 pb-24 pt-3 md:px-6 md:pb-8 md:pt-6">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}

function SideNav() {
  return (
    <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-56 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground md:block">
      <nav className="flex flex-col gap-0.5 p-3">
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
        <div className="my-2 border-t border-border" />
        <div className="px-3 pb-1 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Mehr
        </div>
        {SECONDARY_NAV.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 text-[10px] leading-relaxed text-muted-foreground">
        Daten: Open-Meteo, Bright Sky / DWD, DWD Radar. Privat, ohne Login.
      </div>
    </aside>
  );
}

function NavItem({ to, label, icon: Icon }: NavItemDef) {
  return (
    <Link
      to={to}
      search={keepSearch}
      activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
      inactiveProps={{ className: "text-sidebar-foreground/80 hover:bg-sidebar-accent/60" }}
      activeOptions={{ exact: to === "/" }}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
      )}
      preload="intent"
    >
      <Icon className="h-4 w-4" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function BottomNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {PRIMARY_NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          search={keepSearch}
          activeProps={{ className: "text-primary" }}
          inactiveProps={{ className: "text-muted-foreground" }}
          activeOptions={{ exact: to === "/" }}
          className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium"
        >
          <Icon className="h-5 w-5" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
            <span>Mehr</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Mehr</SheetTitle>
          </SheetHeader>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {SECONDARY_NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                search={keepSearch}
                onClick={() => setOpen(false)}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium hover:bg-accent"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-muted-foreground">
            Daten: Open-Meteo, Bright Sky / DWD, DWD Radar.
          </p>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

/** Behält aktive Search-Params (lat/lon/name) beim Navigieren zwischen Tabs. */
const keepSearch = (prev: Record<string, unknown>) => prev;
