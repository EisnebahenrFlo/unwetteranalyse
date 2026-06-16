import { useEffect, useState } from "react";
import { getSettings, setSettings as persist, type Settings } from "@/lib/storage/settings";

export function useSettings(): [Settings, (next: Settings) => void] {
  const [settings, setLocal] = useState<Settings>(() => getSettings());
  useEffect(() => {
    const handler = () => setLocal(getSettings());
    window.addEventListener("meteoflo:settings-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("meteoflo:settings-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  const update = (next: Settings) => {
    persist(next);
    setLocal(next);
  };
  return [settings, update];
}
