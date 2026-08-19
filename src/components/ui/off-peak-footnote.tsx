import { cn, isOffPeakNote } from "@/lib/utils";

/** Inline "†" marker next to an off-peak price. */
export function OffPeakMark() {
  return (
    <sup className="ml-0.5 font-bold" title="Off-peak rate; peak windows bill 2×">
      †
    </sup>
  );
}

/**
 * "† off-peak rate" footnote — renders only when at least one row carries an
 * off-peak pricing note. Server-safe (no hooks).
 */
export function OffPeakFootnote({
  rows,
  className,
}: {
  rows: readonly { note?: string }[];
  className?: string;
}) {
  if (!rows.some((r) => isOffPeakNote(r.note))) return null;
  return (
    <p className={cn("font-mono text-[11px] text-ink2", className)}>
      <sup className="font-bold">†</sup> off-peak rate; peak windows bill 2×
    </p>
  );
}
