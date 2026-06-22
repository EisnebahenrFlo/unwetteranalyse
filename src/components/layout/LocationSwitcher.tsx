import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crosshair, Loader2, MapPin, Search, Star, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSavedLocations } from "@/hooks/use-saved-locations";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  addSavedLocation, removeSavedLocation, moveSavedLocation, isFavorite,
} from "@/lib/storage/saved-locations";
import { classifyQuery, getCurrentLocation } from "@/lib/geo/geocoding";
import { geocodingQuery } from "@/lib/weather/queries";
import { FavoriteRow, FavoriteEmpty } from "./FavoriteRow";
import type { GeoPoint } from "@/lib/weather/types";
import { cn } from "@/lib/utils";

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

/** Trigger-Button für Header. */
function TriggerButton({ active }: { active: ActivePoint }) {
  return (
    <button className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent">
      <MapPin className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{active.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {[active.admin, active.country].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
    </button>
  );
}

/**
 * Ortswechsel & Favoritenverwaltung in einem Panel.
 * Auf Mobilgeräten als Sheet (großflächig, daumenfreundlich), auf Desktop als Popover.
 */
export function LocationSwitcher() {
  const active = useActivePoint();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const trigger = <TriggerButton active={active} />;
  const panel = <SwitcherPanel onClose={() => setOpen(false)} active={active} />;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4">
          <SheetHeader className="text-left">
            <SheetTitle>Ortswechsel</SheetTitle>
          </SheetHeader>
          <div className="mt-3">{panel}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[380px] p-3">
        {panel}
      </PopoverContent>
    </Popover>
  );
}

/* ----------------------------- Panel ----------------------------- */

function SwitcherPanel({ active, onClose }: { active: ActivePoint; onClose: () => void }) {
  const navigate = useNavigate();
  const saved = useSavedLocations();
  const [rawQuery, setRawQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [gpsState, setGpsState] = useState<"idle" | "loading" | "error">("idle");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce 250 ms — verhindert Request-Sturm beim Tippen.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(rawQuery.trim()), 250);
    return () => window.clearTimeout(id);
  }, [rawQuery]);

  // Suchfeld beim Öffnen fokussieren.
  useEffect(() => { inputRef.current?.focus(); }, []);

  const cls = useMemo(() => classifyQuery(rawQuery), [rawQuery]);
  const search = useQuery({ ...geocodingQuery(debounced), retry: 0 });

  const pick = (p: GeoPoint) => {
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        lat: p.lat, lon: p.lon, name: p.name, country: p.country, admin: p.admin,
      }),
    });
    onClose();
    setRawQuery("");
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

  const placeholder = "Ort, Postleitzahl oder GPS (z. B. 52.52, 13.41)";
  const kindBadge =
    cls.kind === "coords" ? "GPS-Koordinaten erkannt" :
    cls.kind === "postal" ? "Postleitzahl" :
    cls.kind === "name" && rawQuery.length >= 2 ? "Ortsname" : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Suche */}
      <div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-background px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            inputMode="search"
            className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          {rawQuery && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRawQuery("")} aria-label="Leeren">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
          <span>{kindBadge ?? "Suche unterstützt Name, PLZ und Koordinaten."}</span>
          <button
            onClick={handleGps}
            disabled={gpsState === "loading"}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium transition-colors",
              "hover:bg-accent disabled:opacity-60",
            )}
          >
            {gpsState === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
            Meinen Standort
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
          {search.isLoading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Suche läuft …
            </div>
          )}
          {search.isError && (
            <div className="px-3 py-3 text-xs text-amber-700 dark:text-amber-300">
              Suche fehlgeschlagen. Eingabe prüfen oder erneut versuchen.
            </div>
          )}
          {search.data && search.data.length === 0 && !search.isLoading && (
            <div className="px-3 py-3 text-xs text-muted-foreground">Keine Treffer.</div>
          )}
          {search.data && search.data.length > 0 && (
            <ul className="max-h-72 overflow-y-auto py-1">
              {search.data.map((r) => (
                <SearchResultRow
                  key={`${r.lat}-${r.lon}-${r.name}`}
                  result={r}
                  alreadyFav={isFavorite(r)}
                  onPick={pick}
                  onAddFavorite={(g) => { addSavedLocation(g); }}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Favoriten */}
      <div>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Favoriten</div>
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
                canRemove={!l.id.startsWith("default-")}
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
  result, alreadyFav, onPick, onAddFavorite,
}: {
  result: GeoPoint & { postal?: string };
  alreadyFav: boolean;
  onPick: (g: GeoPoint) => void;
  onAddFavorite: (g: GeoPoint) => void;
}) {
  const [pinned, setPinned] = useState(alreadyFav);
  const meta = [
    (result as { postal?: string }).postal,
    result.admin,
    result.country,
  ].filter(Boolean).join(" · ");
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
        onClick={(e) => { e.stopPropagation(); onAddFavorite(result); setPinned(true); }}
        aria-label={pinned ? "Bereits Favorit" : "Als Favorit speichern"}
        title={pinned ? "Bereits Favorit" : "Als Favorit speichern"}
      >
        <Star className={cn("h-3.5 w-3.5", pinned ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
      </Button>
    </li>
  );
}
