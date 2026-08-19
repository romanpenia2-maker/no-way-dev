"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BenchmarkValue, LeaderboardRow } from "@/lib/data/benchmarks";
import { cn } from "@/lib/utils";

type SortKey = "model" | "elo" | "rank" | "swe" | "gpqa" | "aime" | "lcb" | "mmmu" | "hle";

const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "model", label: "Model" },
  { key: "elo", label: "Arena Elo", numeric: true },
  { key: "rank", label: "Arena Rank", numeric: true },
  { key: "swe", label: "SWE-bench", numeric: true },
  { key: "gpqa", label: "GPQA", numeric: true },
  { key: "aime", label: "AIME 2025", numeric: true },
  { key: "lcb", label: "LiveCodeBench", numeric: true },
  { key: "mmmu", label: "MMMU", numeric: true },
  { key: "hle", label: "HLE", numeric: true },
];

function valueOf(row: LeaderboardRow, key: SortKey): number | undefined {
  switch (key) {
    case "elo":
      return row.elo;
    case "rank":
      return row.rank;
    case "swe":
      return row.sweBench?.score;
    case "gpqa":
      return row.gpqa?.score;
    case "aime":
      return row.aime?.score;
    case "lcb":
      return row.liveCodeBench?.score;
    case "mmmu":
      return row.mmmu?.score;
    case "hle":
      return row.hle?.score;
    default:
      return undefined;
  }
}

function ScoreCell({ value }: { value?: BenchmarkValue }) {
  if (!value) {
    return <TableCell className="text-right font-mono text-ink2 nums">—</TableCell>;
  }
  return (
    <TableCell className="text-right font-mono nums" title={value.note}>
      {value.score.toFixed(1)}
      {value.note ? <sup className="ml-0.5 font-bold">†</sup> : null}
    </TableCell>
  );
}

export function BenchmarksTable({ rows }: { rows: LeaderboardRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("elo");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "model") return a.modelName.localeCompare(b.modelName) * dir;
      const av = valueOf(a, sortKey);
      const bv = valueOf(b, sortKey);
      if (av === undefined && bv === undefined) return b.elo - a.elo;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return (av - bv) * dir;
    });
  }, [rows, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      // rank is a place (1 = best); everything else sorts high → low
      setSortAsc(key === "model" || key === "rank");
    }
  }

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn("cursor-pointer select-none hover:text-ink", col.numeric && "text-right")}
                  onClick={() => toggleSort(col.key)}
                  aria-sort={sortKey === col.key ? (sortAsc ? "ascending" : "descending") : undefined}
                >
                  {col.label} {sortKey === col.key ? (sortAsc ? "↑" : "↓") : ""}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow key={row.modelSlug} className="row-fade cursor-pointer">
                <TableCell className="font-mono text-xs text-ink2 nums">
                  {String(i + 1).padStart(2, "0")}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/models/${row.modelSlug}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {row.modelName}
                  </Link>{" "}
                  <Badge variant={row.openWeights ? "outline" : "solid"} className="ml-1 align-middle">
                    {row.openWeights ? "Open" : "Closed"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono font-bold nums">{row.elo}</TableCell>
                <TableCell className="text-right font-mono text-ink2 nums">{row.rank}</TableCell>
                <ScoreCell value={row.sweBench} />
                <ScoreCell value={row.gpqa} />
                <ScoreCell value={row.aime} />
                <ScoreCell value={row.liveCodeBench} />
                <ScoreCell value={row.mmmu} />
                <ScoreCell value={row.hle} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile rows */}
      <div className="md:hidden">
        {sorted.map((row, i) => (
          <div key={row.modelSlug} className="row-fade border-b border-line py-3">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/models/${row.modelSlug}`} className="font-semibold underline-offset-4 hover:underline">
                {row.modelName}
              </Link>
              <span className="font-mono text-xl font-bold nums">{row.elo}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink2 nums">
              <span>{String(i + 1).padStart(2, "0")}</span>
              <Badge variant={row.openWeights ? "outline" : "solid"}>
                {row.openWeights ? "Open" : "Closed"}
              </Badge>
              <span>rank {row.rank}</span>
              {row.sweBench ? <span>swe {row.sweBench.score.toFixed(1)}</span> : null}
              {row.gpqa ? <span>gpqa {row.gpqa.score.toFixed(1)}</span> : null}
              {row.aime ? <span>aime {row.aime.score.toFixed(1)}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
