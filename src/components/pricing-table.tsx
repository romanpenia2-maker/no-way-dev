"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PriceRow } from "@/lib/data/models";
import { formatDate, formatPricePer1M, formatTokens, cn } from "@/lib/utils";

type SortKey = "model" | "provider" | "input" | "output" | "context" | "updated";

const columns: { key: SortKey; label: string; numeric?: boolean; hideMobile?: boolean }[] = [
  { key: "model", label: "Model" },
  { key: "provider", label: "Provider" },
  { key: "input", label: "Input $/1M", numeric: true },
  { key: "output", label: "Output $/1M", numeric: true },
  { key: "context", label: "Context", numeric: true },
  { key: "updated", label: "Updated" },
];

export function PricingTable({ rows }: { rows: PriceRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("input");
  const [sortAsc, setSortAsc] = useState(true);
  const [provider, setProvider] = useState("all");
  const [capability, setCapability] = useState("all");

  const providers = useMemo(
    () => [...new Set(rows.map((r) => r.pricingProvider))].sort(),
    [rows],
  );
  const capabilities = useMemo(
    () => [...new Set(rows.flatMap((r) => r.capabilities))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    let out = rows;
    if (provider !== "all") out = out.filter((r) => r.pricingProvider === provider);
    if (capability !== "all") out = out.filter((r) => r.capabilities.includes(capability as never));
    const dir = sortAsc ? 1 : -1;
    return [...out].sort((a, b) => {
      switch (sortKey) {
        case "model":
          return a.modelName.localeCompare(b.modelName) * dir;
        case "provider":
          return a.pricingProvider.localeCompare(b.pricingProvider) * dir;
        case "input":
          return (a.inputPer1M - b.inputPer1M) * dir;
        case "output":
          return (a.outputPer1M - b.outputPer1M) * dir;
        case "context":
          return (a.contextTokens - b.contextTokens) * dir;
        case "updated":
          return a.updatedAt.localeCompare(b.updatedAt) * dir;
      }
    });
  }, [rows, provider, capability, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "model" || key === "provider" ? true : key !== "updated");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border border-line p-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">
          Provider
          <Select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-44">
            <option value="all">All providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">
          Capability
          <Select value={capability} onChange={(e) => setCapability(e.target.value)} className="w-44">
            <option value="all">All capabilities</option>
            {capabilities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <span className="font-mono text-[11px] text-ink2 nums sm:ml-auto">
          {String(filtered.length).padStart(2, "0")}/{String(rows.length).padStart(2, "0")} rows
        </span>
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
            {filtered.map((row, i) => (
              <TableRow key={`${row.modelSlug}-${row.pricingProvider}`} className="row-fade cursor-pointer">
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
                <TableCell className="text-ink2">{row.pricingProvider}</TableCell>
                <TableCell className="text-right font-mono font-bold nums">
                  {formatPricePer1M(row.inputPer1M)}
                </TableCell>
                <TableCell className="text-right font-mono font-bold nums">
                  {formatPricePer1M(row.outputPer1M)}
                </TableCell>
                <TableCell className="text-right font-mono text-ink2 nums">
                  {formatTokens(row.contextTokens)}
                </TableCell>
                <TableCell className="font-mono text-xs text-ink2 nums">{formatDate(row.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile rows: имя + главное число, остальное второй строкой */}
      <div className="md:hidden">
        {filtered.map((row, i) => (
          <div key={`${row.modelSlug}-${row.pricingProvider}`} className="row-fade border-b border-line py-3">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/models/${row.modelSlug}`} className="font-semibold underline-offset-4 hover:underline">
                {row.modelName}
              </Link>
              <span className="font-mono text-xl font-bold nums">{formatPricePer1M(row.inputPer1M)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink2 nums">
              <span>{String(i + 1).padStart(2, "0")}</span>
              <Badge variant={row.openWeights ? "outline" : "solid"}>
                {row.openWeights ? "Open" : "Closed"}
              </Badge>
              <span>{row.pricingProvider}</span>
              <span>out {formatPricePer1M(row.outputPer1M)}</span>
              <span>ctx {formatTokens(row.contextTokens)}</span>
              <span>upd {formatDate(row.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
