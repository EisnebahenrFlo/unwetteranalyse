import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Crosshair, Loader2, MapPin, Search, Star, X } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSavedLocations } from "@/hooks/use-saved-locations";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  addSavedLocation,
  moveSavedLocation,
  removeSavedLocation,
  isFavorite,
} from "@/lib/storage/saved-locations";
import { classifyQuery, getCurrentLocation, searchLocations } from "@/lib/geo/geocoding";
import { FavoriteRow, FavoriteEmpty } from "./FavoriteRow";
import type { GeoPoint } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

/**
 * Fallback, wenn weder Search-Params noch Favoriten existieren.
 * Bewusst nicht als Favorit gespeichert — nur damit die App initial
 * irgendetwas anzeigen kann, bis ein Ort gewählt wurde.
 */
const INITIAL_FALLBACK: GeoPoint = {
  lat: 52.52,
  lon: 13.405,
  name: "Berlin",
  country: "DE",
  admin: "Berlin",
};

export type ActivePoint = GeoPoint;

export function useActivePoint(): ActivePoint {
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const saved = useSavedLocations();
  const lat = Number(search.lat);
  const lon = Number(search.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return {
      lat,
      lon,
      name: typeof search.name === "string" ? search.name : "Eigener Ort",
      country: typeof search.country === "string" ? search.country : undefined,
      admin: typeof search.admin === "string" ? search.admin : undefined,
    };
  }
  return saved[0] ?? INITIAL_FALLBACK;
}

/* ----------------------------- Trigger ----------------------------- */

const TriggerButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active: ActivePoint }
>(function TriggerButton({ active, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      {...props}
      className={cn(
        "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent",
        className,
      )}
    >
      <MapPin className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{active.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {[active.admin, active.country].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
});

/* ----------------------------- Switcher ----------------------------- */

export function LocationSwitcher() {
  const active = useActivePoint();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const trigger = <TriggerButton active={active} />;
  const panel = <SwitcherPanel active={active} onClose={() => setOpen(false)} />;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4">
          <SheetHeader className="text-left">
            <SheetTitle>Ort wählen</SheetTitle>
          </SheetHeader>
          <div className="mt-3">{panel}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[400px] p-3">
        {panel}
      </PopoverContent>
    </Popover>
  );
}

/* ----------------------------- Panel ----------------------------- */

function SwitcherPanel({ active, onClose }: { active: ActivePoint; onClose: () => void }) {
  const navigate = useNavigate();
  const saved = useSavedLocations();
  const [raw, setRaw] = useState("");
  const [debounced, setDebounced] = useState("");
  const [gpsState, setGpsState] = useState<"idle" | "loading" | "error">("idle");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(raw.trim()), 250);
    return () => window.clearTimeout(id);
  }, [raw]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const cls = useMemo(() => classifyQuery(raw), [raw]);

  const results = useQuery({
    queryKey: ["geocoding", debounced],
    queryFn: () => searchLocations(debounced),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });

  const pick = (p: GeoPoint) => {
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        lat: p.lat,
        lon: p.lon,
        name: p.name,
        country: p.country,
        admin: p.admin,
      }),
    });
    setRaw("");
    onClose();
  };

  const handleGps = async () => {
    setGpsState("loading");
    setGpsError(null);
    try {
      const p = await getCurrentLocation();
      addSavedLocation(p);
      pick(p);
      setGpsState("idle");
    } catch (e) {
      setGpsError(e instanceof Error ? e.message : "Standort fehlgeschlagen.");
      setGpsState("error");
    }
  };

  const kindHint =
    cls.kind === "coords"
      ? "GPS-Koordinaten erkannt"
      : cls.kind === "postal"
        ? "Postleitzahl"
        : cls.kind === "name" && raw.length >= 2
          ? "Ortsname"
          : "Name, PLZ oder Koordinaten (z. B. 52.52, 13.41)";

  return (
    <div className="flex flex-col gap-3">
      {/* Suche */}
      <div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-background px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Ort, PLZ oder GPS"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            inputMode="search"
            autoComplete="off"
            className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          {raw && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setRaw("")}
              aria-label="Leeren"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
          <span className="truncate">{kindHint}</span>
          <button
            onClick={handleGps}
            disabled={gpsState === "loading"}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium transition-colors hover:bg-accent disabled:opacity-60"
          >
            {gpsState === "loading" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Crosshair className="h-3 w-3" />
            )}
            Mein Standort
          </button>
        </div>
        {gpsError && (
          <div className="mt-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
            {gpsError}
          </div>
        )}
      </div>

      {/* Trefferliste */}
      {debounced.length >= 2 && (
        <div className="rounded-lg border border-border bg-background">
          {results.isLoading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Suche läuft …
            </div>
          )}
          {results.isError && (
            <div className="px-3 py-3 text-xs text-amber-700 dark:text-amber-300">
              Suche fehlgeschlagen. Eingabe prüfen oder erneut versuchen.
            </div>
          )}
          {results.data && results.data.length === 0 && !results.isLoading && (
            <div className="px-3 py-3 text-xs text-muted-foreground">Keine Treffer.</div>
          )}
          {results.data && results.data.length > 0 && (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.data.map((r) => (
                <SearchResultRow
                  key={`${r.lat}-${r.lon}-${r.name}`}
                  result={r}
                  alreadyFav={isFavorite(r)}
                  onPick={pick}
                  onAddFavorite={(g) => {
                    addSavedLocation(g);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Favoriten */}
      <div>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Favoriten
          </div>
          <div className="text-[11px] text-muted-foreground">{saved.length}</div>
        </div>
        {saved.length === 0 ? (
          <FavoriteEmpty />
        ) : (
          <div className="flex flex-col gap-1.5">
            {saved.map((l, idx) => (
              <FavoriteRow
                key={l.id}
                location={l}
                isActive={l.lat === active.lat && l.lon === active.lon}
                canMoveUp={idx > 0}
                canMoveDown={idx < saved.length - 1}
                onPick={pick}
                onMove={moveSavedLocation}
                onRemove={removeSavedLocation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Search result row ----------------------------- */

function SearchResultRow({
  result,
  alreadyFav,
  onPick,
  onAddFavorite,
}: {
  result: GeoPoint & { postal?: string };
  alreadyFav: boolean;
  onPick: (g: GeoPoint) => void;
  onAddFavorite: (g: GeoPoint) => void;
}) {
  const [pinned, setPinned] = useState(alreadyFav);
  const meta = [result.postal, result.admin, result.country].filter(Boolean).join(" · ");
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 px-1">
      <button
        onClick={() => onPick(result)}
        className="min-w-0 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
      >
        <div className="truncate font-medium">{result.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{meta || "—"}</div>
      </button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={(e) => {
          e.stopPropagation();
          onAddFavorite(result);
          setPinned(true);
        }}
        aria-label={pinned ? "Bereits Favorit" : "Als Favorit speichern"}
        title={pinned ? "Bereits Favorit" : "Als Favorit speichern"}
      >
        <Star
          className={cn(
            "h-3.5 w-3.5",
            pinned ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
          )}
        />
      </Button>
    </li>
  );
}
