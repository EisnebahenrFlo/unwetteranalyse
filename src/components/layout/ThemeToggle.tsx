import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import type { ThemeMode } from "@/lib/storage/settings";

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [settings, setSettings] = useSettings();

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  const cycle = () => {
    const next: ThemeMode = settings.theme === "light" ? "dark" : settings.theme === "dark" ? "system" : "light";
    setSettings({ ...settings, theme: next });
  };

  const Icon = settings.theme === "dark" ? Moon : settings.theme === "system" ? Monitor : Sun;

  return (
    <Button size="icon" variant="ghost" onClick={cycle} aria-label={`Theme: ${settings.theme}`}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}
