import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface AnchorItem {
  id: string;
  label: string;
  hint?: string;
}

interface Props {
  items: AnchorItem[];
  /** Offset oberhalb in px für Sticky-Header. */
  scrollOffset?: number;
}

/**
 * Sekundärnavigation mit Sprungankern und einfachem Scroll-Spy.
 * Mobile: horizontal scrollbar mit Snap. Desktop: gleichmäßige Verteilung.
 */
export function StickySubnav({ items, scrollOffset = 96 }: Props) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const handler = () => {
      const probe = scrollOffset + 24;
      let current = items[0]?.id ?? "";
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - probe <= 0) current = it.id;
      }
      setActive(current);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [items, scrollOffset]);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - scrollOffset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <nav className="sticky top-[57px] z-20 -mx-3 border-b border-border/80 bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:-mx-6 md:px-6">
      <ul className="scroll-snap-x flex min-w-0 gap-1 overflow-x-auto py-1.5 md:gap-2">
        {items.map((it, idx) => {
          const isActive = active === it.id;
          return (
            <li key={it.id} className="shrink-0">
              <button
                type="button"
                onClick={() => jump(it.id)}
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors",
                  isActive
                    ? "border-foreground/20 bg-foreground/5 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/80">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="font-medium">{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}