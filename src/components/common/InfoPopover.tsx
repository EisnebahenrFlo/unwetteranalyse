import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "@/components/icons";
import type { ReactNode } from "react";

export function InfoPopover({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Erklärung zu ${title}`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-xs text-xs leading-relaxed">
        <div className="font-semibold text-foreground">{title}</div>
        <div className="mt-1 text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
