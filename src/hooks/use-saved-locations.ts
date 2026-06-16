import { useEffect, useState } from "react";
import { getSavedLocations } from "@/lib/storage/saved-locations";
import type { SavedLocation } from "@/lib/weather/types";

export function useSavedLocations(): SavedLocation[] {
  const [list, setList] = useState<SavedLocation[]>(() => getSavedLocations());
  useEffect(() => {
    const handler = () => setList(getSavedLocations());
    window.addEventListener("meteoflo:locations-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("meteoflo:locations-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return list;
}
