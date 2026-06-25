import { Moon, Sun, Monitor } from "@/components/icons";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import type { ThemeMode } from "@/lib/storage/settings";

/**
 * Manueller Theme-Toggle: zyklisch Auto → Hell → Dunkel.
 * Die eigentliche Anwendung der `.dark`-Klasse passiert in `useAdaptiveTheme`
 * (Route-Default + manuelle Überschreibung).
 */
const LABEL: Record<ThemeMode, string> = {
  auto: "Theme: Auto (folgt Route)",
  light: "Theme: Hell",
  dark: "Theme: Dunkel",
};

export function ThemeToggle() {
  const [settings, setSettings] = useSettings();

  const cycle = () => {
    const next: ThemeMode =
      settings.theme === "auto" ? "light" : settings.theme === "light" ? "dark" : "auto";
    setSettings({ ...settings, theme: next });
  };

  const Icon =
    settings.theme === "dark" ? Moon : settings.theme === "light" ? Sun : Monitor;

  return (
    <Button size="icon" variant="ghost" onClick={cycle} aria-label={LABEL[settings.theme]}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}
