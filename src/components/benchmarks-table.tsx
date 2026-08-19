"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ARENA_CATEGORY_ORDER,
  DEFAULT_ARENA_CATEGORY,
  isArenaCategory,
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

/** Models with no verified benchmark entries — what to show instead of an empty list. */
const EMPTY_BENCHMARK_NOTES: Record<string, string> = {
  "glm-5-3":
    "GLM-5.2 anchors (vendor claims): SWE-bench Verified 84.2, SWE-bench Pro 62.1, GPQA 91.2, Terminal-Bench 2.1 81.0–82.7 (harness-dependent)",
  "grok-4-6":
    "AA Intelligence Index 61 (Aug 2026), xAI claims gains across 10 launch benchmarks vs Grok 4.5",
};

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

function ScoreCell({ value }: { value?: BenchmarkValue }) {
  if (!value) {
    return <TableCell className="hidden text-right font-mono text-ink2 nums lg:table-cell">—</TableCell>;
  }
  return (
    <TableCell className="hidden text-right font-mono nums lg:table-cell" title={value.note}>
      {value.score.toFixed(1)}
      {value.note ? <sup className="ml-0.5 font-bold">†</sup> : null}
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
}: {
  row: LeaderboardRow;
  active: ArenaCategory;
  slices: Record<ArenaCategory, CategorySlice>;
}) {
  const activeMeta = slices[active].meta;
  const emptyNote = EMPTY_BENCHMARK_NOTES[row.modelSlug];
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

export function BenchmarksExplorer({ slices }: { slices: Record<ArenaCategory, CategorySlice> }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const param = searchParams.get("cat");
  const cat: ArenaCategory = param && isArenaCategory(param) ? param : DEFAULT_ARENA_CATEGORY;
  const slice = slices[cat];

  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Close the open row when switching slices (its model may not be ranked there).
  useEffect(() => {
    setExpanded(null);
  }, [cat]);

  const selectTab = useCallback(
    (next: ArenaCategory) => {
      const qs = next === DEFAULT_ARENA_CATEGORY ? "" : `?cat=${next}`;
      router.replace(`${pathname}${qs}`, { scroll: false });
    },
    [router, pathname],
  );

  /* Sliding ink indicator under the active tab */
  const tablistRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<ArenaCategory, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const el = tabRefs.current[cat];
    const box = tablistRef.current;
    if (!el || !box) return;
    const boxRect = box.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setIndicator({ left: rect.left - boxRect.left, width: rect.width });
  }, [cat]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

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
      // rank is a place (1 = best); everything else sorts high → low
      setSortAsc(key === "model" || key === "rank");
    }
  }

  const top = slice.rows[0];
  const stats = [
    { label: "Models ranked", value: String(slice.rows.length).padStart(2, "0"), trend: "▲ of 13 tracked, top-20 cut" },
    { label: "Top score", value: top ? String(top.arena.elo) : "—", trend: top ? `▲ ${top.modelName}` : "" },
    {
      label: "Votes",
      value: formatCompact(slice.meta.votes),
      trend: `▲ ${slice.meta.totalModels} models on full board`,
    },
    { label: "Snapshot", value: formatDate(slice.meta.snapshotAt), trend: "▲ arena.ai leaderboard" },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div ref={tablistRef} className="relative border-b border-ink" role="tablist" aria-label="Arena category">
        <div className="flex flex-wrap">
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
                "px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors sm:px-4",
                c === cat ? "text-ink" : "text-ink2 hover:text-ink",
              )}
            >
              {tabLabel(c, slices)}
            </button>
          ))}
        </div>
        <span
          className="ink-indicator absolute bottom-[-1px] h-[2px] bg-ink"
          style={{ left: indicator.left, width: indicator.width }}
          aria-hidden
        />
      </div>

      {/* Stats strip + table re-render per slice with a snappy fade/rise */}
      <div key={cat} className="slice-enter space-y-6">
        <div className="grid grid-cols-2 border border-line sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                "space-y-2 px-4 py-5",
                i > 0 && "border-l border-line",
                i === 2 && "max-sm:border-l-0",
              )}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">{s.label}</p>
              <p className="font-mono text-2xl font-bold leading-none nums sm:text-3xl">{s.value}</p>
              <p className="font-mono text-[11px] text-ink2">{s.trend}</p>
            </div>
          ))}
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
                          className="px-1"
                        >
                          <Chevron open={open} />
                        </button>
                      </TableCell>
                    </TableRow>
                    <tr className={cn(open ? "border-b border-line" : "border-0")}>
                      <td colSpan={columns.length + 2} className="p-0">
                        <div className="expand-grid" data-open={open} id={`panel-${row.modelSlug}`}>
                          <div className="expand-inner">
                            <ExpandedPanel row={row} active={cat} slices={slices} />
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
                      <ExpandedPanel row={row} active={cat} slices={slices} />
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
          — not measured / not published · <sup className="font-bold">†</sup> score has a caveat — hover the cell for
          details, see footnotes below · <span className="font-bold">P</span> preliminary rating (low vote count) ·
          click a row to expand full arena &amp; benchmark data.
        </p>
      </div>
    </div>
  );
}
