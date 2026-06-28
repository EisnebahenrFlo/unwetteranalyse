import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface AnchorItem {
  id: string;
  label: string;
  hint?: string;
}

interface Props {
  items: AnchorItem[];
  value: string;
  onChange: (id: string) => void;
}

export function StickySubnav({ items, value, onChange }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = items.findIndex((it) => it.id === value);
    if (idx === -1) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(items[(idx + 1) % items.length].id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(items[(idx - 1 + items.length) % items.length].id);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(items[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(items[items.length - 1].id);
    }
  };

  return (
    <nav className="sticky top-[57px] z-30 -mx-3 border-b border-border bg-background/95 px-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 md:-mx-6 md:px-6">
      <ul
        ref={listRef}
        role="tablist"
        aria-label="Cockpit-Bereiche"
        onKeyDown={onKeyDown}
        className="flex min-w-0 gap-1 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-2"
      >
        {items.map((it, idx) => {
          const isActive = value === it.id;
          return (
            <li key={it.id} className="shrink-0">
              <button
                type="button"
                role="tab"
                id={`tab-${it.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${it.id}`}
                tabIndex={isActive ? 0 : -1}
                data-active={isActive}
                onClick={() => onChange(it.id)}
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
