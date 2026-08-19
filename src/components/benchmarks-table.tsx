"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ARENA_CATEGORY_ORDER,
  DEFAULT_ARENA_CATEGORY,
  type BenchmarkValue,
  type CategorySlice,
  type LeaderboardRow,
} from "@/lib/arena";
import type { ArenaCategory } from "@data/schemas/model.schema";
import { cn, formatCompact, formatDate, formatPricePer1M, formatTokens } from "@/lib/utils";

type SortKey = "model" | "score" | "rank" | "ci" | "swe" | "terminal" | "gpqa" | "hle";

const columns: { key: SortKey; label: string; numeric?: boolean; hideBelowLg?: boolean }[] = [
  { key: "model", label: "Model" },
  { key: "score", label: "Arena score", numeric: true },
  { key: "rank", label: "Rank", numeric: true },
  { key: "ci", label: "CI ±", numeric: true, hideBelowLg: true },
  { key: "swe", label: "SWE-bench Pro", numeric: true, hideBelowLg: true },
  { key: "terminal", label: "Terminal-Bench", numeric: true, hideBelowLg: true },
  { key: "gpqa", label: "GPQA", numeric: true, hideBelowLg: true },
  { key: "hle", label: "HLE", numeric: true, hideBelowLg: true },
];

function tabLabel(cat: ArenaCategory, slices: Record<ArenaCategory, CategorySlice>): string {
  return cat === "text" ? "Overall" : slices[cat].meta.label;
}

function valueOf(row: LeaderboardRow, key: SortKey): number | undefined {
  switch (key) {
    case "score":
      return row.arena.elo;
    case "rank":
      return row.arena.rank;
    case "ci":
      return row.arena.ci;
    case "swe":
      return row.sweBenchPro?.score;
    case "terminal":
      return row.terminalBench?.score;
    case "gpqa":
      return row.gpqa?.score;
    case "hle":
      return row.hle?.score;
    default:
      return undefined;
  }
}

/** Focusable caveat marker with a CSS-only tooltip (hover on fine pointers, focus/tap elsewhere). */
function Caveat({ note }: { note: string }) {
  return (
    <span tabIndex={0} role="note" aria-label={`Caveat: ${note}`} className="caveat relative ml-0.5 inline-block">
      <sup className="font-bold" aria-hidden>
        †
      </sup>
      <span className="caveat-tip" aria-hidden>
        {note}
      </span>
    </span>
  );
}

function ScoreCell({ value }: { value?: BenchmarkValue }) {
  if (!value) {
    return <TableCell className="hidden text-right font-mono text-ink2 nums lg:table-cell">—</TableCell>;
  }
  return (
    <TableCell className="hidden text-right font-mono nums lg:table-cell">
      {value.score.toFixed(1)}
      {value.note ? <Caveat note={value.note} /> : null}
    </TableCell>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span data-open={open} className="chevron inline-block font-mono text-xs text-ink2" aria-hidden>
      ▾
    </span>
  );
}

function ExpandedPanel({
  row,
  active,
  slices,
  emptyNotes,
}: {
  row: LeaderboardRow;
  active: ArenaCategory;
  slices: Record<ArenaCategory, CategorySlice>;
  emptyNotes: Record<string, string>;
}) {
  const activeMeta = slices[active].meta;
  const emptyNote = emptyNotes[row.modelSlug];
  return (
    <div className="grid gap-8 border-t border-line p-4 sm:p-6 md:grid-cols-2">
      {/* Arena slices */}
      <div>
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">Arena</h3>
        <ul className="mt-3 space-y-3">
          {ARENA_CATEGORY_ORDER.map((cat) => {
            const a = row.arenaAll[cat];
            if (!a) return null;
            return (
              <li key={cat} className="border-l-2 border-ink pl-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink2">
                    {slices[cat].meta.label}
                  </span>
                  <span className="font-mono text-lg font-bold nums">
                    {a.elo}
                    <span className="ml-1 text-xs font-normal text-ink2">±{a.ci}</span>
                  </span>
                  {a.preliminary ? (
                    <Badge variant="solid" title="Preliminary — low vote count">
                      P
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-ink2 nums">
                  rank #{a.rank} · {a.votes.toLocaleString("en-US")} votes · {a.boardName}
                </p>
                {a.note ? <p className="mt-1 text-[13px] leading-5 text-ink2">{a.note}</p> : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 font-mono text-[11px] leading-5 text-ink2 nums">
          Snapshot {formatDate(activeMeta.snapshotAt)} · {formatCompact(activeMeta.votes)} votes ·{" "}
          {activeMeta.totalModels} models on board ·{" "}
          <a
            href={activeMeta.sourceUrl}
            rel="noopener nofollow"
            className="underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
          >
            leaderboard ↗
          </a>
        </p>
      </div>

      {/* Benchmarks */}
      <div>
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">Benchmarks</h3>
        {row.benchmarks.length ? (
          <ul className="mt-3 space-y-3">
            {row.benchmarks.map((b) => (
              <li key={`${b.name}-${b.sourceUrl}`} className="border-l-2 border-line pl-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{b.name}</span>
                  <span className="font-mono text-lg font-bold nums">{b.score.toFixed(1)}</span>
                  <a
                    href={b.sourceUrl}
                    rel="noopener nofollow"
                    className="font-mono text-[11px] underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
                  >
                    Source ↗
                  </a>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-ink2 nums">tested {formatDate(b.testedAt)}</p>
                {b.note ? <p className="mt-1 text-[13px] leading-5 text-ink2">{b.note}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-semibold">No verified benchmarks published yet</p>
            {emptyNote ? <p className="text-[13px] leading-5 text-ink2">{emptyNote}</p> : null}
          </div>
        )}
      </div>

      {/* Quick facts */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 font-mono text-[11px] text-ink2 nums md:col-span-2">
        <span>
          <span className="uppercase tracking-[0.08em]">Provider</span> {row.modelProvider}
        </span>
        <span>
          <span className="uppercase tracking-[0.08em]">Context</span> {formatTokens(row.contextTokens)}
        </span>
        <span>
          <span className="uppercase tracking-[0.08em]">Price in/out</span> {formatPricePer1M(row.priceIn)}/
          {formatPricePer1M(row.priceOut)}
        </span>
        <Link
          href={`/models/${row.modelSlug}`}
          className="ml-auto text-ink underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
        >
          Full model page →
        </Link>
      </div>
    </div>
  );
}

export function BenchmarksExplorer({
  slices,
  initialCat,
  invalidCat,
  trackedModels,
  emptyNotes,
}: {
  slices: Record<ArenaCategory, CategorySlice>;
  initialCat: ArenaCategory;
  /** True when the URL carried an unknown ?cat= value — the client cleans it up. */
  invalidCat?: boolean;
  trackedModels: number;
  emptyNotes: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const cat = initialCat;
  const slice = slices[cat];

  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Close the open row when switching slices (its model may not be ranked there).
  useEffect(() => {
    setExpanded(null);
  }, [cat]);

  // Unknown ?cat= value — strip it from the URL.
  useEffect(() => {
    if (invalidCat) router.replace(pathname, { scroll: false });
  }, [invalidCat, router, pathname]);

  const selectTab = useCallback(
    (next: ArenaCategory) => {
      const qs = next === DEFAULT_ARENA_CATEGORY ? "" : `?cat=${next}`;
      router.replace(`${pathname}${qs}`, { scroll: false });
    },
    [router, pathname],
  );

  /* Scroll-strip tabs: the active tab carries its own ink underline and is scrolled into view. */
  const tabRefs = useRef<Partial<Record<ArenaCategory, HTMLButtonElement | null>>>({});

  useEffect(() => {
    tabRefs.current[cat]?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [cat]);

  // APG-lite: ArrowLeft/ArrowRight move between tabs (selection follows focus).
  const onTablistKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const idx = ARENA_CATEGORY_ORDER.indexOf(cat);
      const next =
        ARENA_CATEGORY_ORDER[
          (idx + (e.key === "ArrowRight" ? 1 : -1) + ARENA_CATEGORY_ORDER.length) % ARENA_CATEGORY_ORDER.length
        ];
      selectTab(next);
      tabRefs.current[next]?.focus();
    },
    [cat, selectTab],
  );

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...slice.rows].sort((a, b) => {
      if (sortKey === "model") return a.modelName.localeCompare(b.modelName) * dir;
      const av = valueOf(a, sortKey);
      const bv = valueOf(b, sortKey);
      if (av === undefined && bv === undefined) return b.arena.elo - a.arena.elo;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return (av - bv) * dir;
    });
  }, [slice.rows, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      // model/rank are places or names (a→z, 1 = best); CI is an uncertainty margin (small = best);
      // everything else sorts high → low
      setSortAsc(key === "model" || key === "rank" || key === "ci");
    }
  }

  const top = slice.rows[0];
  const stats: { label: string; value: string; trend: string; small?: boolean }[] = [
    {
      label: "Models ranked",
      value: String(slice.rows.length).padStart(2, "0"),
      trend: `▲ of ${trackedModels} tracked, top-20 cut`,
    },
    { label: "Top score", value: top ? String(top.arena.elo) : "—", trend: top ? `▲ ${top.modelName}` : "" },
    {
      label: "Votes",
      value: formatCompact(slice.meta.votes),
      trend: `▲ ${slice.meta.totalModels} models on full board`,
    },
    { label: "Snapshot", value: formatDate(slice.meta.snapshotAt), trend: "▲ arena.ai leaderboard", small: true },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs: nowrap scroll-strip, active tab underlined in ink */}
      <div className="border-b border-ink" role="tablist" aria-label="Arena category" onKeyDown={onTablistKeyDown}>
        <div className="no-scrollbar -mb-px flex flex-nowrap overflow-x-auto snap-x snap-mandatory">
          {ARENA_CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              ref={(el) => {
                tabRefs.current[c] = el;
              }}
              role="tab"
              aria-selected={c === cat}
              onClick={() => selectTab(c)}
              className={cn(
                "shrink-0 snap-start border-b-2 px-3 py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors sm:px-4 sm:py-2.5",
                c === cat ? "-mb-px border-ink text-ink" : "border-transparent text-ink2 hover:text-ink",
              )}
            >
              {tabLabel(c, slices)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats strip + table re-render per slice with a snappy fade/rise */}
      <div key={cat} className="slice-enter space-y-6">
        <div className="grid grid-cols-2 border border-line sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                "min-w-0 space-y-2 px-4 py-5",
                i > 0 && "border-l border-line",
                i === 2 && "max-sm:border-l-0",
                i >= 2 && "max-sm:border-t max-sm:border-line",
              )}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">{s.label}</p>
              <p
                className={cn(
                  "font-mono font-bold leading-none nums",
                  s.small ? "text-lg sm:text-3xl" : "text-2xl sm:text-3xl",
                )}
              >
                {s.value}
              </p>
              <p className="font-mono text-[11px] text-ink2">{s.trend}</p>
            </div>
          ))}
        </div>

        {/* Mobile sort control (columns are not tappable on small screens) */}
        <div className="flex items-center gap-2 md:hidden">
          <label
            htmlFor="benchmarks-sort"
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2"
          >
            Sort by
          </label>
          <Select
            id="benchmarks-sort"
            value={sortKey}
            onChange={(e) => toggleSort(e.target.value as SortKey)}
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
            onClick={() => setSortAsc(!sortAsc)}
            aria-label={sortAsc ? "Sort descending" : "Sort ascending"}
            className="flex h-9 w-9 items-center justify-center border border-ink font-mono text-sm hover:bg-ink hover:text-paper"
          >
            {sortAsc ? "↑" : "↓"}
          </button>
        </div>

        {/* Desktop table */}
        <Card className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "cursor-pointer select-none hover:text-ink",
                      col.numeric && "text-right",
                      col.hideBelowLg && "hidden lg:table-cell",
                    )}
                    onClick={() => toggleSort(col.key)}
                    aria-sort={sortKey === col.key ? (sortAsc ? "ascending" : "descending") : undefined}
                  >
                    {col.label} {sortKey === col.key ? (sortAsc ? "↑" : "↓") : ""}
                  </TableHead>
                ))}
                <TableHead className="w-8" aria-label="expand" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row, i) => {
                const open = expanded === row.modelSlug;
                return (
                  <Fragment key={row.modelSlug}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpanded(open ? null : row.modelSlug)}
                    >
                      <TableCell className="font-mono text-xs text-ink2 nums">
                        {String(i + 1).padStart(2, "0")}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/models/${row.modelSlug}`}
                          className="font-semibold underline-offset-4 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.modelName}
                        </Link>{" "}
                        <Badge variant={row.openWeights ? "outline" : "solid"} className="ml-1 align-middle">
                          {row.openWeights ? "Open" : "Closed"}
                        </Badge>
                        {row.arena.preliminary ? (
                          <Badge variant="secondary" className="ml-1 align-middle" title="Preliminary — low vote count">
                            P
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold nums">{row.arena.elo}</TableCell>
                      <TableCell className="text-right font-mono text-ink2 nums">{row.arena.rank}</TableCell>
                      <TableCell className="hidden text-right font-mono text-ink2 nums lg:table-cell">
                        {row.arena.ci}
                      </TableCell>
                      <ScoreCell value={row.sweBenchPro} />
                      <ScoreCell value={row.terminalBench} />
                      <ScoreCell value={row.gpqa} />
                      <ScoreCell value={row.hle} />
                      <TableCell className="text-right">
                        <button
                          aria-expanded={open}
                          aria-controls={`panel-${row.modelSlug}`}
                          aria-label={open ? `Collapse ${row.modelName}` : `Expand ${row.modelName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(open ? null : row.modelSlug);
                          }}
                          className="p-2 -m-1"
                        >
                          <Chevron open={open} />
                        </button>
                      </TableCell>
                    </TableRow>
                    <tr className={cn(open ? "border-b border-line" : "border-0")}>
                      <td colSpan={columns.length + 2} className="p-0">
                        <div className="expand-grid" data-open={open} id={`panel-${row.modelSlug}`}>
                          <div className="expand-inner">
                            <ExpandedPanel row={row} active={cat} slices={slices} emptyNotes={emptyNotes} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Mobile rows */}
        <div className="md:hidden">
          {sorted.map((row, i) => {
            const open = expanded === row.modelSlug;
            return (
              <div key={row.modelSlug} className="border-b border-line py-3">
                <button
                  className="block w-full text-left"
                  aria-expanded={open}
                  aria-controls={`m-panel-${row.modelSlug}`}
                  onClick={() => setExpanded(open ? null : row.modelSlug)}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">
                      {row.modelName}{" "}
                      {row.arena.preliminary ? (
                        <Badge variant="secondary" title="Preliminary — low vote count">
                          P
                        </Badge>
                      ) : null}
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-xl font-bold nums">{row.arena.elo}</span>
                      <Chevron open={open} />
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink2 nums">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <Badge variant={row.openWeights ? "outline" : "solid"}>
                      {row.openWeights ? "Open" : "Closed"}
                    </Badge>
                    <span>rank {row.arena.rank}</span>
                    <span>±{row.arena.ci}</span>
                    {row.sweBenchPro ? <span>swe-pro {row.sweBenchPro.score.toFixed(1)}</span> : null}
                    {row.terminalBench ? <span>tb {row.terminalBench.score.toFixed(1)}</span> : null}
                  </div>
                </button>
                <div className="expand-grid" data-open={open} id={`m-panel-${row.modelSlug}`}>
                  <div className="expand-inner">
                    <div className="pt-3">
                      <ExpandedPanel row={row} active={cat} slices={slices} emptyNotes={emptyNotes} />
                    </div>
                    <div className="mt-3 pb-1">
                      <Link
                        href={`/models/${row.modelSlug}`}
                        className="font-mono text-xs uppercase tracking-[0.08em] underline underline-offset-4"
                      >
                        Model page →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="font-mono text-[11px] leading-5 text-ink2">
          — not measured / not published · <sup className="font-bold">†</sup> score has a caveat — focus or tap the
          marker for details, see footnotes below · <span className="font-bold">P</span> preliminary rating (low vote
          count) · sort by any column · open a row for full arena &amp; benchmark data.
        </p>
      </div>
    </div>
  );
}
