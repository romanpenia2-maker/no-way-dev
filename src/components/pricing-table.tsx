"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { OffPeakFootnote, OffPeakMark } from "@/components/ui/off-peak-footnote";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { WeightsBadge } from "@/components/ui/weights-badge";
import type { PriceRow } from "@/lib/data/models";
import {
  CTX_MIN_OPTIONS,
  DEFAULT_PRICING_STATE,
  type PricingTableState,
} from "@/lib/pricing-state";
import { useSortable } from "@/lib/use-sortable";
import { formatDate, formatPricePer1M, formatTokens, isOffPeakNote } from "@/lib/utils";

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

  const [provider, setProvider] = useState(initial.provider);
  const [capability, setCapability] = useState(initial.capability);
  const [openOnly, setOpenOnly] = useState(initial.openOnly);
  const [ctx, setCtx] = useState(initial.ctx);

  const providerName = (slug: string) => providerNames[slug] ?? slug;

  const columns = useMemo<DataColumn<PriceRow>[]>(
    () => [
      {
        key: "model",
        label: "Model",
        ascByDefault: true,
        sortValue: (row) => row.modelName,
        render: (row) => (
          <>
            <Link href={`/models/${row.modelSlug}`} className="font-semibold underline-offset-4 hover:underline">
              {row.modelName}
            </Link>{" "}
            <WeightsBadge open={row.openWeights} className="ml-1 align-middle" />
          </>
        ),
        exportValue: (row) => row.modelName,
      },
      {
        key: "provider",
        label: "Provider",
        ascByDefault: true,
        sortValue: (row) => providerName(row.pricingProvider),
        render: (row) => <span className="text-ink2">{providerName(row.pricingProvider)}</span>,
        exportValue: (row) => providerName(row.pricingProvider),
      },
      {
        key: "input",
        label: "Input $/1M",
        numeric: true,
        ascByDefault: true,
        sortValue: (row) => row.inputPer1M,
        render: (row) => (
          <span className="font-bold">
            {formatPricePer1M(row.inputPer1M)}
            {isOffPeakNote(row.note) ? <OffPeakMark /> : null}
          </span>
        ),
        exportValue: (row) => formatPricePer1M(row.inputPer1M),
      },
      {
        key: "cached",
        label: "Cached $/1M",
        numeric: true,
        ascByDefault: true,
        sortValue: (row) => row.cachedInputPer1M,
        // Models without a published cached rate sink to the bottom.
        tiebreak: (a, b) => a.inputPer1M - b.inputPer1M,
        render: (row) =>
          row.cachedInputPer1M !== undefined ? (
            formatPricePer1M(row.cachedInputPer1M)
          ) : (
            <span className="text-ink2">—</span>
          ),
        exportValue: (row) =>
          row.cachedInputPer1M !== undefined ? formatPricePer1M(row.cachedInputPer1M) : "—",
      },
      {
        key: "output",
        label: "Output $/1M",
        numeric: true,
        ascByDefault: true,
        sortValue: (row) => row.outputPer1M,
        render: (row) => <span className="font-bold">{formatPricePer1M(row.outputPer1M)}</span>,
        exportValue: (row) => formatPricePer1M(row.outputPer1M),
      },
      {
        key: "context",
        label: "Context",
        numeric: true,
        ascByDefault: true,
        sortValue: (row) => row.contextTokens,
        render: (row) => <span className="text-ink2">{formatTokens(row.contextTokens)}</span>,
        exportValue: (row) => formatTokens(row.contextTokens),
      },
      {
        key: "updated",
        label: "Updated",
        sortValue: (row) => row.updatedAt,
        render: (row) => <span className="font-mono text-xs text-ink2 nums">{formatDate(row.updatedAt)}</span>,
        exportValue: (row) => formatDate(row.updatedAt),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providerNames],
  );

  const filtered = useMemo(() => {
    let out = rows;
    if (provider !== "all") out = out.filter((r) => r.pricingProvider === provider);
    if (capability !== "all") out = out.filter((r) => r.capabilities.includes(capability as never));
    if (openOnly) out = out.filter((r) => r.openWeights);
    const ctxMin = CTX_MIN_OPTIONS[ctx];
    if (ctxMin) out = out.filter((r) => r.contextTokens >= ctxMin);
    return out;
  }, [rows, provider, capability, openOnly, ctx]);

  const sort = useSortable<PriceRow, DataColumn<PriceRow>>(filtered, columns, initial.sortKey, initial.sortAsc);
  const { sortKey, sortAsc } = sort;

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
        <span className="font-mono text-[11px] text-ink2 nums sm:ml-auto">
          {filtered.length} of {rows.length} models
        </span>
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        sort={sort}
        rowKey={(row) => `${row.modelSlug}-${row.pricingProvider}`}
        rowId={(row) => `row-${row.modelSlug}`}
        rowLabel={(row) => row.modelName}
        sortSelectId="pricing-sort"
        mobileHead={(row) => ({
          title: (
            <Link href={`/models/${row.modelSlug}`} className="underline-offset-4 hover:underline">
              {row.modelName}
            </Link>
          ),
          value: (
            <span className="font-mono text-xl font-bold nums">
              {formatPricePer1M(row.inputPer1M)}
              {isOffPeakNote(row.note) ? <OffPeakMark /> : null}
            </span>
          ),
        })}
        mobileMeta={(row) => (
          <>
            <WeightsBadge open={row.openWeights} />
            <span>{providerName(row.pricingProvider)}</span>
            <span>cached {row.cachedInputPer1M !== undefined ? formatPricePer1M(row.cachedInputPer1M) : "—"}</span>
            <span>out {formatPricePer1M(row.outputPer1M)}</span>
            <span>ctx {formatTokens(row.contextTokens)}</span>
            <span>upd {formatDate(row.updatedAt)}</span>
          </>
        )}
      />

      <OffPeakFootnote rows={filtered} />
    </div>
  );
}
