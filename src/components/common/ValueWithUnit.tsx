import { cn } from "@/lib/utils";

export function ValueWithUnit({
  value, unit, size = "md", className, hint,
}: {
  value: string;
  unit?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  hint?: string;
}) {
  const sizes = {
    sm: "text-base",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-5xl md:text-6xl",
  };
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("font-mono font-semibold tracking-tight text-foreground", sizes[size])} style={{ fontFamily: "var(--font-mono)" }}>
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
