import type { Metadata } from "next";
import { PricingTable } from "@/components/pricing-table";
import {
  CTX_MIN_OPTIONS,
  DEFAULT_PRICING_STATE,
  PRICING_SORT_KEYS,
  type PricingTableState,
} from "@/lib/pricing-state";
import { getAllPriceRows } from "@/lib/data/models";
import { getProviderNameMap } from "@/lib/data/providers";

export const metadata: Metadata = {
  title: "LLM API Pricing — all models, all providers",
  description:
    "Full table of LLM API prices per 1M tokens: input, output and cached input across OpenAI, Anthropic, Google, DeepSeek, xAI and more. Sortable, filterable, sourced.",
  alternates: { canonical: "/pricing" },
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PricingPage({ searchParams }: Props) {
  const rows = getAllPriceRows();
  const sp = await searchParams;

  // SSR the slice matching the query string; unknown values fall back to
  // defaults and the client strips them from the URL (same pattern as /benchmarks).
  const rawSort = first(sp.sort);
  const sortKey = (PRICING_SORT_KEYS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as PricingTableState["sortKey"])
    : DEFAULT_PRICING_STATE.sortKey;

  const rawDir = first(sp.dir);
  const sortAsc = rawDir === "desc" ? false : DEFAULT_PRICING_STATE.sortAsc;

  const providers = new Set(rows.map((r) => r.pricingProvider));
  const rawProvider = first(sp.provider);
  const provider = rawProvider && providers.has(rawProvider) ? rawProvider : DEFAULT_PRICING_STATE.provider;

  const capabilities = new Set(rows.flatMap((r) => r.capabilities));
  const rawCap = first(sp.cap);
  const capability = rawCap && capabilities.has(rawCap as never) ? rawCap : DEFAULT_PRICING_STATE.capability;

  const openOnly = first(sp.open) === "1";

  const rawCtx = first(sp.ctx);
  const ctx = rawCtx && rawCtx in CTX_MIN_OPTIONS ? rawCtx : DEFAULT_PRICING_STATE.ctx;

  const initial: PricingTableState = { sortKey, sortAsc, provider, capability, openOnly, ctx };

  return (
    <div className="w-full px-4 py-12 sm:px-6 lg:px-12">
      <div className="mb-8 max-w-2xl space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Reference / 01</p>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-5xl">
          API pricing
        </h1>
        <p className="text-[15px] leading-7 text-ink2">
          {rows.length} pricing entries across {new Set(rows.map((r) => r.modelSlug)).size} models. Prices in USD
          per 1M tokens. Sort by any column; every row links back to the official source. The URL mirrors the
          current sort and filters — share it to share the view.
        </p>
      </div>
      <PricingTable rows={rows} providerNames={getProviderNameMap()} initial={initial} />
    </div>
  );
}
