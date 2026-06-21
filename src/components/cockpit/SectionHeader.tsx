import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  eyebrow: string;
  title: string;
  question?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Einheitlicher Sektions-Header für das Cockpit.
 * `eyebrow` ist die Kategorie (z. B. „01 · Lage"), `question` die fachliche Leitfrage.
 */
export function SectionHeader({ id, eyebrow, title, question, action, className }: Props) {
  return (
    <header
      id={id}
      className={cn("scroll-mt-28 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-border/70 pb-2", className)}
    >
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</div>
        <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">{title}</h2>
        {question && <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{question}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}