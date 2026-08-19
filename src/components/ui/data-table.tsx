"use client";

import { Fragment } from "react";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButtons } from "@/components/export-buttons";
import { toCsv, toMarkdown } from "@/lib/export";
import { useSortable, type SortState, type SortableColumn } from "@/lib/use-sortable";
import { cn, formatOrdinal } from "@/lib/utils";

/**
 * One data-table implementation for the whole hub: column defs drive the
 * desktop table, the mobile view, the mobile sort control and the export
 * payload (header from labels, cells from exportValue).
 */

export interface DataColumn<Row> extends SortableColumn<Row> {
  /** Hide on viewports below lg (desktop table only). */
  hideBelowLg?: boolean;
  /** Hide on viewports below sm (mobileMode="table"). */
  hideBelowSm?: boolean;
  /** Extra classes on both th and td. */
  className?: string;
  render: (row: Row, index: number) => React.ReactNode;
  exportValue: (row: Row) => string | number;
}

export interface ExpandableRows<Row> {
  openKey: string | null;
  onToggle: (key: string) => void;
  renderPanel: (row: Row) => React.ReactNode;
  /** Extra content under the mobile panel (e.g. a "Model page →" link). */
  mobilePanelExtra?: (row: Row) => React.ReactNode;
}

interface DataTableProps<Row> {
  rows: Row[];
  columns: DataColumn<Row>[];
  rowKey: (row: Row) => string;
  /** DOM id per row (deep-link target), rendered without the prefix here. */
  rowId?: (row: Row) => string;
  /** Accessible row name for expand buttons (e.g. model name). */
  rowLabel?: (row: Row) => string;
  /**
   * "cards" = desktop table + mobile card list (needs mobileHead/mobileMeta);
   * "table" = one responsive table at every breakpoint (use hideBelowSm).
   */
  mobileMode?: "cards" | "table";
  mobileHead?: (row: Row) => { title: React.ReactNode; value?: React.ReactNode };
  mobileMeta?: (row: Row, index: number) => React.ReactNode;
  expandable?: ExpandableRows<Row>;
  sortable?: boolean;
  withExport?: boolean;
  /** Controlled sort state from a wrapper's useSortable (e.g. URL-synced). */
  sort?: SortState & { sorted: Row[] };
  initialSortKey?: string;
  /** Rendered inside the Card, under the table (e.g. OffPeakFootnote). */
  cardFooter?: React.ReactNode;
  /** id for the mobile sort <select> (label htmlFor). */
  sortSelectId: string;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span data-open={open} className="chevron inline-block font-mono text-xs text-ink2" aria-hidden>
      ▾
    </span>
  );
}

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  rowId,
  rowLabel,
  mobileMode = "cards",
  mobileHead,
  mobileMeta,
  expandable,
  sortable = true,
  withExport = true,
  sort,
  initialSortKey,
  cardFooter,
  sortSelectId,
}: DataTableProps<Row>) {
  const internal = useSortable(rows, columns, initialSortKey ?? columns[0].key);
  const { sorted, sortKey, sortAsc, toggleSort, ariaSort } = sort ?? internal;
  const activeSorted = sortable ? sorted : rows;

  const exportHeader = columns.map((c) => c.label.replace(/\s*†$/, ""));
  const exportRows = activeSorted.map((row) => columns.map((c) => c.exportValue(row)));

  const colSpan = columns.length + 1 + (expandable ? 1 : 0);

  const headerRow = (
    <TableRow>
      <TableHead className="w-10">#</TableHead>
      {columns.map((col) => (
        <TableHead
          key={col.key}
          className={cn(
            sortable && "cursor-pointer select-none hover:text-ink",
            col.numeric && "text-right",
            col.hideBelowLg && mobileMode === "cards" && "hidden lg:table-cell",
            col.hideBelowSm && "hidden sm:table-cell",
            col.className,
          )}
          onClick={sortable ? () => toggleSort(col.key) : undefined}
          aria-sort={sortable ? ariaSort(col.key) : undefined}
        >
          {col.label} {sortable && sortKey === col.key ? (sortAsc ? "↑" : "↓") : ""}
        </TableHead>
      ))}
      {expandable ? <TableHead className="w-8" aria-label="expand" /> : null}
    </TableRow>
  );

  const tableBody = (
    <TableBody>
      {activeSorted.map((row, i) => {
        const key = rowKey(row);
        const open = expandable?.openKey === key;
        return (
          <Fragment key={key}>
            <TableRow
              id={rowId?.(row)}
              className={cn("row-fade", expandable && "cursor-pointer")}
              onClick={expandable ? () => expandable.onToggle(key) : undefined}
            >
              <TableCell className="font-mono text-xs text-ink2 nums">{formatOrdinal(i)}</TableCell>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    col.numeric && "text-right font-mono nums",
                    col.hideBelowLg && mobileMode === "cards" && "hidden lg:table-cell",
                    col.hideBelowSm && "hidden sm:table-cell",
                    col.className,
                  )}
                >
                  {col.render(row, i)}
                </TableCell>
              ))}
              {expandable ? (
                <TableCell className="text-right">
                  <button
                    aria-expanded={open}
                    aria-controls={`panel-${key}`}
                    aria-label={`${open ? "Collapse" : "Expand"} ${rowLabel?.(row) ?? `row ${formatOrdinal(i)}`}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      expandable.onToggle(key);
                    }}
                    className="p-2 -m-1"
                  >
                    <Chevron open={open ?? false} />
                  </button>
                </TableCell>
              ) : null}
            </TableRow>
            {expandable ? (
              <tr className={cn(open ? "border-b border-line" : "border-0")}>
                <td colSpan={colSpan} className="p-0">
                  <div className="expand-grid" data-open={open ?? false} id={`panel-${key}`}>
                    <div className="expand-inner">{expandable.renderPanel(row)}</div>
                  </div>
                </td>
              </tr>
            ) : null}
          </Fragment>
        );
      })}
    </TableBody>
  );

  return (
    <div className="space-y-4">
      {/* Mobile sort control (columns are not tappable on small screens) + export */}
      {((sortable && mobileMode === "cards") || withExport) && (
        <div className="flex flex-wrap items-center gap-2">
          {sortable && mobileMode === "cards" ? (
            <div className="flex items-center gap-2 md:hidden">
              <label
                htmlFor={sortSelectId}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2"
              >
                Sort by
              </label>
              <Select
                id={sortSelectId}
                value={sortKey}
                onChange={(e) => toggleSort(e.target.value)}
                className="w-40"
              >
                {columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => toggleSort(sortKey)}
                aria-label={sortAsc ? "Sort descending" : "Sort ascending"}
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-ink font-mono text-sm hover:bg-ink hover:text-paper"
              >
                {sortAsc ? "↑" : "↓"}
              </button>
            </div>
          ) : null}
          {withExport ? (
            <div className="ml-auto">
              <ExportButtons csv={toCsv(exportHeader, exportRows)} markdown={toMarkdown(exportHeader, exportRows)} />
            </div>
          ) : null}
        </div>
      )}

      {mobileMode === "table" ? (
        <Card className="row-fade">
          <Table>
            <TableHeader>{headerRow}</TableHeader>
            {tableBody}
          </Table>
          {cardFooter}
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>{headerRow}</TableHeader>
              {tableBody}
            </Table>
            {cardFooter}
          </Card>

          {/* Mobile card list */}
          <div className="md:hidden">
            {activeSorted.map((row, i) => {
              const key = rowKey(row);
              const open = expandable?.openKey === key;
              const head = mobileHead?.(row);
              const inner = (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-semibold">{head?.title}</span>
                    <span className="flex items-baseline gap-2">
                      {head?.value}
                      {expandable ? <Chevron open={open ?? false} /> : null}
                    </span>
                  </div>
                  {mobileMeta ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink2 nums">
                      <span>{formatOrdinal(i)}</span>
                      {mobileMeta(row, i)}
                    </div>
                  ) : null}
                </>
              );
              return (
                <div key={key} id={rowId?.(row)} className="row-fade border-b border-line py-3">
                  {expandable ? (
                    <button
                      className="block w-full text-left"
                      aria-expanded={open}
                      aria-controls={`m-panel-${key}`}
                      onClick={() => expandable.onToggle(key)}
                    >
                      {inner}
                    </button>
                  ) : (
                    inner
                  )}
                  {expandable ? (
                    <div className="expand-grid" data-open={open ?? false} id={`m-panel-${key}`}>
                      <div className="expand-inner">
                        <div className="pt-3">{expandable.renderPanel(row)}</div>
                        {expandable.mobilePanelExtra ? (
                          <div className="mt-3 pb-1">{expandable.mobilePanelExtra(row)}</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
