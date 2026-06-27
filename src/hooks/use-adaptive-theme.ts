import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useSettings } from "@/hooks/use-settings";
import type { ThemeMode } from "@/lib/storage/settings";

/**
 * Route-Default für das Adaptive-Theming:
 *  - /map (Radar/Live) → dunkel
 *  - /analysis, /alerts, /settings → hell
 *  - / (Dashboard) → tageszeitabhängig, fallback hell
 *  - sonst → hell
 */
function routeDefault(pathname: string, hour: number): "light" | "dark" {
  if (pathname.startsWith("/map")) return "dark";
  if (pathname.startsWith("/forecast-maps")) return "dark";
  if (pathname === "/") return hour >= 6 && hour < 19 ? "light" : "dark";
  return "light";
}

function applyDark(dark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function resolveDark(theme: ThemeMode, pathname: string): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  const hour = new Date().getHours();
  return routeDefault(pathname, hour) === "dark";
}

/**
 * Wendet das adaptive Theme an: manuelle Einstellung > Route-Default.
 * Wird einmal in `AppShell` montiert.
 */
export function useAdaptiveTheme() {
  const [settings] = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    applyDark(resolveDark(settings.theme, pathname));
  }, [settings.theme, pathname]);

  // Re-evaluate im Auto-Modus alle 5 min (Stundenwechsel auf dem Dashboard).
  useEffect(() => {
    if (settings.theme !== "auto") return;
    const id = window.setInterval(() => {
      applyDark(resolveDark("auto", pathname));
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [settings.theme, pathname]);
}