import type { Metadata } from "next";
import { PricingTable } from "@/components/pricing-table";
import { getAllPriceRows } from "@/lib/data/models";
import { getProviderNameMap } from "@/lib/data/providers";

export const metadata: Metadata = {
  title: "LLM API Pricing — all models, all providers",
  description:
    "Full table of LLM API prices per 1M tokens: input, output and cached input across OpenAI, Anthropic, Google, DeepSeek, xAI and more. Sortable, filterable, sourced.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  const rows = getAllPriceRows();

  return (
    <div className="w-full px-4 py-12 sm:px-6 lg:px-12">
      <div className="mb-8 max-w-2xl space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Reference / 01</p>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-5xl">
          API pricing
        </h1>
        <p className="text-[15px] leading-7 text-ink2">
          {rows.length} pricing entries across {new Set(rows.map((r) => r.modelSlug)).size} models. Prices in USD
          per 1M tokens. Sort by any column; every row links back to the official source.
        </p>
      </div>
      <PricingTable rows={rows} providerNames={getProviderNameMap()} />
    </div>
  );
}
