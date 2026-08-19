import { useCallback, useMemo, useState } from "react";

/**
 * Shared column-sorting for data tables (client hook — no node builtins).
 * Rows with an undefined sort value always sink to the bottom, regardless of
 * direction. Text/rank columns declare `ascByDefault` (a→z, 1 = best);
 * numeric columns default to high → low.
 */

export interface SortableColumn<Row> {
  key: string;
  label: string;
  numeric?: boolean;
  /** First click sorts ascending (names, ranks); default: numeric desc / text asc. */
  ascByDefault?: boolean;
  sortValue?: (row: Row) => number | string | undefined;
  /** Tie-break when both sort values are equal or both undefined. */
  tiebreak?: (a: Row, b: Row) => number;
}

export interface SortState {
  sortKey: string;
  sortAsc: boolean;
  toggleSort: (key: string) => void;
  /** Value for the th's aria-sort attribute. */
  ariaSort: (key: string) => "ascending" | "descending" | undefined;
}

export function useSortable<Row, C extends SortableColumn<Row>>(
  rows: Row[],
  columns: C[],
  initialKey: string,
  initialAsc?: boolean,
): SortState & { sorted: Row[] } {
  const defaultAsc = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      return col?.ascByDefault ?? (col?.numeric ? false : true);
    },
    [columns],
  );

  const [sortKey, setSortKey] = useState(initialKey);
  const [sortAsc, setSortAsc] = useState(initialAsc ?? defaultAsc(initialKey));

  const toggleSort = useCallback(
    (key: string) => {
      if (key === sortKey) {
        setSortAsc((asc) => !asc);
      } else {
        setSortKey(key);
        setSortAsc(defaultAsc(key));
      }
    },
    [sortKey, defaultAsc],
  );

  const ariaSort = useCallback(
    (key: string) => (sortKey === key ? (sortAsc ? "ascending" : "descending") : undefined),
    [sortKey, sortAsc],
  );

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    const dir = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col?.sortValue?.(a);
      const bv = col?.sortValue?.(b);
      if (av === undefined && bv === undefined) return col?.tiebreak?.(a, b) ?? 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      const cmp =
        typeof av === "string" || typeof bv === "string"
          ? String(av).localeCompare(String(bv))
          : (av as number) - (bv as number);
      return cmp !== 0 ? cmp * dir : (col?.tiebreak?.(a, b) ?? 0);
    });
  }, [rows, columns, sortKey, sortAsc]);

  return { sorted, sortKey, sortAsc, toggleSort, ariaSort };
}
