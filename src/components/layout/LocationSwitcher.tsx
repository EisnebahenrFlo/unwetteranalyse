import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, Star, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSavedLocations } from "@/hooks/use-saved-locations";
import { addSavedLocation, removeSavedLocation } from "@/lib/storage/saved-locations";
import { geocodingQuery } from "@/lib/weather/queries";
import type { GeoPoint } from "@/lib/weather/types";

export interface ActivePoint extends GeoPoint {}

export function useActivePoint(): ActivePoint {
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const saved = useSavedLocations();
  const fallback = saved[0];
  const lat = Number(search.lat);
  const lon = Number(search.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return {
      lat, lon,
      name: typeof search.name === "string" ? search.name : "Eigener Ort",
      country: typeof search.country === "string" ? search.country : undefined,
      admin: typeof search.admin === "string" ? search.admin : undefined,
    };
  }
  return fallback;
}

export function LocationSwitcher() {
  const navigate = useNavigate();
  const active = useActivePoint();
  const saved = useSavedLocations();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useQuery(geocodingQuery(query));

  const pick = (p: GeoPoint) => {
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        lat: p.lat, lon: p.lon, name: p.name, country: p.country, admin: p.admin,
      }),
    });
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{active.name}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {active.admin ? `${active.admin} · ` : ""}{active.country ?? ""}
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-border px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ort suchen (DACH + Italien)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        {query.length >= 2 && (
          <div className="mt-2 max-h-56 overflow-y-auto">
            {search.isLoading && <div className="px-2 py-2 text-xs text-muted-foreground">Suche …</div>}
            {search.data?.length === 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground">Keine Treffer in DACH/Italien.</div>
            )}
            {search.data?.map((r) => (
              <button
                key={`${r.lat}-${r.lon}`}
                onClick={() => { addSavedLocation(r); pick(r); }}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="truncate">{r.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {r.admin ? `${r.admin}, ` : ""}{r.country}
                  </div>
                </div>
                <Star className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 border-t border-border pt-2">
          <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Gespeichert
          </div>
          {saved.map((l) => (
            <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
              <button
                onClick={() => pick(l)}
                className="min-w-0 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <div className="truncate">{l.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {l.admin ? `${l.admin}, ` : ""}{l.country}
                </div>
              </button>
              {!l.id.startsWith("default-") && (
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); removeSavedLocation(l.id); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
