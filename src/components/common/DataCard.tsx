import { Card } from "@/components/ui/card";
import { DataMeta } from "./DataMeta";
import type { DataMeta as DataMetaT } from "@/lib/weather/types";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DataCardProps {
  title: string;
  subtitle?: ReactNode;
  meta?: DataMetaT;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function DataCard({ title, subtitle, meta, action, className, children }: DataCardProps) {
  return (
    <Card className={cn("flex flex-col gap-3 p-4 md:p-5", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="min-w-0">{children}</div>
      {meta && <DataMeta meta={meta} />}
    </Card>
  );
}
