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

const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
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
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
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
        <span className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} of {rows.length} rows
        </span>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn("cursor-pointer select-none hover:text-foreground", col.numeric && "text-right")}
                  onClick={() => toggleSort(col.key)}
                  aria-sort={sortKey === col.key ? (sortAsc ? "ascending" : "descending") : undefined}
                >
                  {col.label} {sortKey === col.key ? (sortAsc ? "↑" : "↓") : ""}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={`${row.modelSlug}-${row.pricingProvider}`}>
                <TableCell className="font-medium">
                  <Link href={`/models/${row.modelSlug}`} className="hover:text-accent hover:underline">
                    {row.modelName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.pricingProvider}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPricePer1M(row.inputPer1M)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPricePer1M(row.outputPer1M)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatTokens(row.contextTokens)}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(row.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {filtered.map((row) => (
          <Card key={`${row.modelSlug}-${row.pricingProvider}`} className="p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Link href={`/models/${row.modelSlug}`} className="font-medium hover:text-accent hover:underline">
                {row.modelName}
              </Link>
              <Badge variant="secondary">{row.pricingProvider}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Input $/1M</dt>
              <dd className="text-right tabular-nums">{formatPricePer1M(row.inputPer1M)}</dd>
              <dt className="text-muted-foreground">Output $/1M</dt>
              <dd className="text-right tabular-nums">{formatPricePer1M(row.outputPer1M)}</dd>
              <dt className="text-muted-foreground">Context</dt>
              <dd className="text-right tabular-nums">{formatTokens(row.contextTokens)}</dd>
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="text-right">{formatDate(row.updatedAt)}</dd>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
