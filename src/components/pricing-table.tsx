"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButtons } from "@/components/export-buttons";
import { toCsv, toMarkdown } from "@/lib/export";
import type { PriceRow } from "@/lib/data/models";
import {
  CTX_MIN_OPTIONS,
  DEFAULT_PRICING_STATE,
  type PricingSortKey,
  type PricingTableState,
} from "@/lib/pricing-state";
import { formatDate, formatPricePer1M, formatTokens, cn, isOffPeakNote } from "@/lib/utils";

const columns: { key: PricingSortKey; label: string; numeric?: boolean }[] = [
  { key: "model", label: "Model" },
  { key: "provider", label: "Provider" },
  { key: "input", label: "Input $/1M", numeric: true },
  { key: "cached", label: "Cached $/1M", numeric: true },
  { key: "output", label: "Output $/1M", numeric: true },
  { key: "context", label: "Context", numeric: true },
  { key: "updated", label: "Updated" },
];

export function PricingTable({
  rows,
  providerNames,
  initial,
}: {
  rows: PriceRow[];
  providerNames: Record<string, string>;
  initial: PricingTableState;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [sortKey, setSortKey] = useState<PricingSortKey>(initial.sortKey);
  const [sortAsc, setSortAsc] = useState(initial.sortAsc);
  const [provider, setProvider] = useState(initial.provider);
  const [capability, setCapability] = useState(initial.capability);
  const [openOnly, setOpenOnly] = useState(initial.openOnly);
  const [ctx, setCtx] = useState(initial.ctx);

  const providerName = (slug: string) => providerNames[slug] ?? slug;

  const providers = useMemo(
    () => [...new Set(rows.map((r) => r.pricingProvider))].sort(),
    [rows],
  );
  const capabilities = useMemo(
    () => [...new Set(rows.flatMap((r) => r.capabilities))].sort(),
    [rows],
  );

  // URL is the shareable source of truth: keep it in sync with the state
  // (this also strips invalid params — the server already fell back to defaults).
  useEffect(() => {
    const params = new URLSearchParams();
    if (sortKey !== DEFAULT_PRICING_STATE.sortKey) params.set("sort", sortKey);
    if (sortAsc !== DEFAULT_PRICING_STATE.sortAsc) params.set("dir", "desc");
    if (provider !== "all") params.set("provider", provider);
    if (capability !== "all") params.set("cap", capability);
    if (openOnly) params.set("open", "1");
    if (ctx) params.set("ctx", ctx);
    const qs = params.toString();
    const hash = window.location.hash;
    router.replace(qs ? `${pathname}?${qs}${hash}` : `${pathname}${hash}`, { scroll: false });
  }, [sortKey, sortAsc, provider, capability, openOnly, ctx, router, pathname]);

  // Deep-link flash: loading with #row-<slug> highlights the row briefly.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#row-")) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("row-flash");
    const t = setTimeout(() => el.classList.remove("row-flash"), 700);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    let out = rows;
    if (provider !== "all") out = out.filter((r) => r.pricingProvider === provider);
    if (capability !== "all") out = out.filter((r) => r.capabilities.includes(capability as never));
    if (openOnly) out = out.filter((r) => r.openWeights);
    const ctxMin = CTX_MIN_OPTIONS[ctx];
    if (ctxMin) out = out.filter((r) => r.contextTokens >= ctxMin);
    const dir = sortAsc ? 1 : -1;
    return [...out].sort((a, b) => {
      switch (sortKey) {
        case "model":
          return a.modelName.localeCompare(b.modelName) * dir;
        case "provider":
          return (
            (providerNames[a.pricingProvider] ?? a.pricingProvider).localeCompare(
              providerNames[b.pricingProvider] ?? b.pricingProvider,
            ) * dir
          );
        case "input":
          return (a.inputPer1M - b.inputPer1M) * dir;
        case "cached": {
          // Models without a published cached rate sink to the bottom.
          if (a.cachedInputPer1M === undefined && b.cachedInputPer1M === undefined)
            return a.inputPer1M - b.inputPer1M;
          if (a.cachedInputPer1M === undefined) return 1;
          if (b.cachedInputPer1M === undefined) return -1;
          return (a.cachedInputPer1M - b.cachedInputPer1M) * dir;
        }
        case "output":
          return (a.outputPer1M - b.outputPer1M) * dir;
        case "context":
          return (a.contextTokens - b.contextTokens) * dir;
        case "updated":
          return a.updatedAt.localeCompare(b.updatedAt) * dir;
      }
    });
  }, [rows, provider, capability, openOnly, ctx, sortKey, sortAsc, providerNames]);

  function toggleSort(key: PricingSortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "model" || key === "provider" ? true : key !== "updated");
    }
  }

  const hasOffPeak = filtered.some((row) => isOffPeakNote(row.note));

  // Export mirrors the active table: same columns, same visible order.
  const exportHeader = useMemo(
    () => ["Model", "Provider", "Input $/1M", "Cached $/1M", "Output $/1M", "Context", "Updated"],
    [],
  );
  const exportRows = useMemo(
    () =>
      filtered.map((row) => [
        row.modelName,
        providerName(row.pricingProvider),
        formatPricePer1M(row.inputPer1M),
        row.cachedInputPer1M !== undefined ? formatPricePer1M(row.cachedInputPer1M) : "—",
        formatPricePer1M(row.outputPer1M),
        formatTokens(row.contextTokens),
        formatDate(row.updatedAt),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border border-line p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">
          Provider
          <Select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-44">
            <option value="all">All providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {providerName(p)}
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
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">
          Context ≥
          <Select value={ctx} onChange={(e) => setCtx(e.target.value)} className="w-28">
            <option value="">Any</option>
            {Object.keys(CTX_MIN_OPTIONS).map((k) => (
              <option key={k} value={k}>
                {formatTokens(CTX_MIN_OPTIONS[k])}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2 sm:min-h-9">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-ink"
          />
          Open weights only
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2 md:hidden">
          Sort by
          <Select value={sortKey} onChange={(e) => toggleSort(e.target.value as PricingSortKey)} className="w-36">
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
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-ink font-mono text-sm hover:bg-ink hover:text-paper"
          >
            {sortAsc ? "↑" : "↓"}
          </button>
        </label>
        <span className="font-mono text-[11px] text-ink2 nums sm:ml-auto">
          {filtered.length} of {rows.length} models
        </span>
      </div>

      <div className="flex items-center justify-end">
        <ExportButtons csv={toCsv(exportHeader, exportRows)} markdown={toMarkdown(exportHeader, exportRows)} />
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
              <TableRow
                key={`${row.modelSlug}-${row.pricingProvider}`}
                id={`row-${row.modelSlug}`}
                className="row-fade cursor-pointer"
              >
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
                <TableCell className="text-ink2">{providerName(row.pricingProvider)}</TableCell>
                <TableCell className="text-right font-mono font-bold nums">
                  {formatPricePer1M(row.inputPer1M)}
                  {isOffPeakNote(row.note) ? (
                    <sup className="ml-0.5 font-bold" title="Off-peak rate; peak windows bill 2×">
                      †
                    </sup>
                  ) : null}
                </TableCell>
                <TableCell className="text-right font-mono nums">
                  {row.cachedInputPer1M !== undefined ? (
                    formatPricePer1M(row.cachedInputPer1M)
                  ) : (
                    <span className="text-ink2">—</span>
                  )}
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
          <div
            key={`${row.modelSlug}-${row.pricingProvider}`}
            id={`row-${row.modelSlug}`}
            className="row-fade border-b border-line py-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/models/${row.modelSlug}`} className="font-semibold underline-offset-4 hover:underline">
                {row.modelName}
              </Link>
              <span className="font-mono text-xl font-bold nums">
                {formatPricePer1M(row.inputPer1M)}
                {isOffPeakNote(row.note) ? (
                  <sup className="ml-0.5 font-bold" title="Off-peak rate; peak windows bill 2×">
                    †
                  </sup>
                ) : null}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink2 nums">
              <span>{String(i + 1).padStart(2, "0")}</span>
              <Badge variant={row.openWeights ? "outline" : "solid"}>
                {row.openWeights ? "Open" : "Closed"}
              </Badge>
              <span>{providerName(row.pricingProvider)}</span>
              <span>cached {row.cachedInputPer1M !== undefined ? formatPricePer1M(row.cachedInputPer1M) : "—"}</span>
              <span>out {formatPricePer1M(row.outputPer1M)}</span>
              <span>ctx {formatTokens(row.contextTokens)}</span>
              <span>upd {formatDate(row.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {hasOffPeak ? (
        <p className="font-mono text-[11px] text-ink2">
          <sup className="font-bold">†</sup> off-peak rate; peak windows bill 2×
        </p>
      ) : null}
    </div>
  );
}
