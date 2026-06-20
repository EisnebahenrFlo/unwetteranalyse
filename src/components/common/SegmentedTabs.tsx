import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedTab<T extends string = string> {
  id: T;
  label: string;
  hint?: string;
  icon?: ReactNode;
}

interface Props<T extends string> {
  tabs: SegmentedTab<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (id: T) => void;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Touch-optimierte Sub-Tab-Leiste mit Snap-Scroll.
 * Kontrolliert oder unkontrolliert nutzbar.
 */
export function SegmentedTabs<T extends string>({
  tabs, value, defaultValue, onChange, size = "md", className,
}: Props<T>) {
  const [internal, setInternal] = useState<T>(defaultValue ?? tabs[0]?.id);
  const active = value ?? internal;
  const set = (id: T) => {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  };
  return (
    <div
      role="tablist"
      className={cn(
        "scroll-snap-x flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1 backdrop-blur",
        className,
      )}
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => set(t.id)}
            className={cn(
              "group relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 font-medium transition-all",
              "min-h-[40px] text-sm",
              size === "sm" && "min-h-[34px] px-2.5 text-xs",
              isActive
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.hint && (
              <span className="hidden text-[10px] font-normal text-muted-foreground sm:inline">
                · {t.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}