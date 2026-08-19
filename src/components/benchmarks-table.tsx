"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { StatsStrip } from "@/components/ui/stats-strip";
import { ValueFootnote } from "@/components/ui/value-footnote";
import { WeightsBadge } from "@/components/ui/weights-badge";
import {
  ARENA_CATEGORY_ORDER,
  DEFAULT_ARENA_CATEGORY,
  type CategorySlice,
  type LeaderboardRow,
} from "@/lib/arena";
import { TRACKED_BENCHMARKS, type TrackedBenchmarkValue } from "@/lib/benchmark-keys";
import { useSortable } from "@/lib/use-sortable";
import { valueScore } from "@/lib/value";
import type { ArenaCategory } from "@data/schemas/model.schema";
import { cn, formatCompact, formatDate, formatPricePer1M, formatTokens } from "@/lib/utils";

function tabLabel(cat: ArenaCategory, slices: Record<ArenaCategory, CategorySlice>): string {
  return cat === "text" ? "Overall" : slices[cat].meta.label;
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

function ScoreValue({ value }: { value?: TrackedBenchmarkValue }) {
  if (!value) return <span className="text-ink2">—</span>;
  return (
    <>
      {value.score.toFixed(1)}
      {value.note ? <Caveat note={value.note} /> : null}
    </>
  );
}

function buildColumns(): DataColumn<LeaderboardRow>[] {
  return [
    {
      key: "model",
      label: "Model",
      ascByDefault: true,
      sortValue: (row) => row.modelName,
      render: (row) => (
        <>
          <Link
            href={`/models/${row.modelSlug}`}
            className="font-semibold underline-offset-4 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.modelName}
          </Link>{" "}
          <WeightsBadge open={row.openWeights} className="ml-1 align-middle" />
          {row.arena.preliminary ? (
            <Badge variant="secondary" className="ml-1 align-middle" title="Preliminary — low vote count">
              P
            </Badge>
          ) : null}
        </>
      ),
      exportValue: (row) => row.modelName,
    },
    {
      key: "score",
      label: "Arena score",
      numeric: true,
      sortValue: (row) => row.arena.elo,
      render: (row) => <span className="font-bold">{row.arena.elo}</span>,
      exportValue: (row) => row.arena.elo,
    },
    {
      key: "value",
      label: "Value †",
      numeric: true,
      sortValue: (row) => valueScore(row.arena.elo, row.priceIn, row.priceOut),
      render: (row) => valueScore(row.arena.elo, row.priceIn, row.priceOut) ?? <span className="text-ink2">—</span>,
      exportValue: (row) => valueScore(row.arena.elo, row.priceIn, row.priceOut) ?? "—",
    },
    {
      key: "rank",
      label: "Rank",
      numeric: true,
      ascByDefault: true,
      sortValue: (row) => row.arena.rank,
      render: (row) => <span className="text-ink2">{row.arena.rank}</span>,
      exportValue: (row) => row.arena.rank,
    },
    ...TRACKED_BENCHMARKS.map(
      (t): DataColumn<LeaderboardRow> => ({
        key: t.key,
        label: t.label,
        numeric: true,
        hideBelowLg: true,
        sortValue: (row) => row.tracked[t.key]?.score,
        tiebreak: (a, b) => b.arena.elo - a.arena.elo,
        render: (row) => <ScoreValue value={row.tracked[t.key]} />,
        exportValue: (row) => row.tracked[t.key]?.score.toFixed(1) ?? "—",
      }),
    ),
  ];
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
        {row.benchmarksNote ? (
          <p className="mt-3 font-mono text-[11px] leading-5 text-ink2">{row.benchmarksNote}</p>
        ) : null}
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
          href={`/compare?models=${row.modelSlug}`}
          className="text-ink underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
        >
          Compare →
        </Link>
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

  const [columns] = useState(buildColumns);
  const sort = useSortable(slice.rows, columns, "score", false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExpanded = useCallback(
    (key: string) => setExpanded((cur) => (cur === key ? null : key)),
    [],
  );

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

  const top = slice.rows[0];
  const stats = [
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
        <StatsStrip items={stats} boxed />

        <DataTable
          rows={slice.rows}
          columns={columns}
          sort={sort}
          rowKey={(row) => row.modelSlug}
          rowLabel={(row) => row.modelName}
          sortSelectId="benchmarks-sort"
          expandable={{
            openKey: expanded,
            onToggle: toggleExpanded,
            renderPanel: (row) => <ExpandedPanel row={row} active={cat} slices={slices} emptyNotes={emptyNotes} />,
            mobilePanelExtra: (row) => (
              <Link
                href={`/models/${row.modelSlug}`}
                className="font-mono text-xs uppercase tracking-[0.08em] underline underline-offset-4"
              >
                Model page →
              </Link>
            ),
          }}
          mobileHead={(row) => ({
            title: (
              <>
                {row.modelName}{" "}
                {row.arena.preliminary ? (
                  <Badge variant="secondary" title="Preliminary — low vote count">
                    P
                  </Badge>
                ) : null}
              </>
            ),
            value: <span className="font-mono text-xl font-bold nums">{row.arena.elo}</span>,
          })}
          mobileMeta={(row) => (
            <>
              <WeightsBadge open={row.openWeights} />
              <span>rank {row.arena.rank}</span>
              <span>±{row.arena.ci}</span>
              <span>value {valueScore(row.arena.elo, row.priceIn, row.priceOut) ?? "—"}</span>
              {row.tracked["swe-pro"] ? <span>swe-pro {row.tracked["swe-pro"].score.toFixed(1)}</span> : null}
              {row.tracked.terminal ? <span>tb {row.tracked.terminal.score.toFixed(1)}</span> : null}
            </>
          )}
        />

        <p className="font-mono text-[11px] leading-5 text-ink2">
          — not measured / not published · <sup className="font-bold">†</sup> score has a caveat — focus or tap the
          marker for details, see footnotes below · <span className="font-bold">P</span> preliminary rating (low vote
          count) · <ValueFootnote /> · sort by any column · open a row for full arena &amp; benchmark data.
        </p>
      </div>
    </div>
  );
}
