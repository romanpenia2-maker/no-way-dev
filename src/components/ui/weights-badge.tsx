import { Badge } from "@/components/ui/badge";

/** Open/Closed weights badge — one place for the variant mapping. */
export function WeightsBadge({ open, className }: { open: boolean; className?: string }) {
  return (
    <Badge variant={open ? "outline" : "solid"} className={className}>
      {open ? "Open" : "Closed"}
    </Badge>
  );
}
