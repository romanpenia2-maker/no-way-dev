import { cn } from "@/lib/utils";

export interface StatsStripItem {
  label: string;
  value: string;
  trend: string;
  /** Smaller value type — for long values like dates. */
  small?: boolean;
}

/**
 * 2×2 (mobile) / 4-across (sm+) stat grid. `boxed` = bordered card look
 * (/benchmarks); default = full-bleed strip with bottom border (home).
 */
export function StatsStrip({ items, boxed }: { items: StatsStripItem[]; boxed?: boolean }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-4",
        boxed ? "border border-line" : "border-b border-line",
      )}
    >
      {items.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            "min-w-0 space-y-2",
            boxed ? "px-4 py-5" : "py-6 pr-4",
            i > 0 && cn("border-l border-line", !boxed && "pl-4"),
            i === 2 && cn("max-sm:border-l-0", !boxed && "max-sm:pl-0"),
            i >= 2 && "max-sm:border-t max-sm:border-line",
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">{s.label}</p>
          <p
            className={cn(
              "font-mono font-bold leading-none nums",
              s.small ? "text-lg sm:text-3xl" : boxed ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl",
            )}
          >
            {s.value}
          </p>
          <p className="font-mono text-[11px] text-ink2">{s.trend}</p>
        </div>
      ))}
    </div>
  );
}
