import type { Metadata } from "next";
import { PricingTable } from "@/components/pricing-table";
import { getAllPriceRows } from "@/lib/data/models";

export const metadata: Metadata = {
  title: "LLM API Pricing — all models, all providers",
  description:
    "Full table of LLM API prices per 1M tokens: input, output and cached input across OpenAI, Anthropic, Google, DeepSeek, xAI and more. Sortable, filterable, sourced.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  const rows = getAllPriceRows();

  return (
    <div className="mx-auto w-full max-w-content px-4 py-12 sm:px-6">
      <div className="mb-8 max-w-2xl space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">API pricing</h1>
        <p className="text-muted-foreground">
          {rows.length} pricing entries across {new Set(rows.map((r) => r.modelSlug)).size} models. Prices in USD
          per 1M tokens. Click a column to sort; every row links back to the official source.
        </p>
      </div>
      <PricingTable rows={rows} />
    </div>
  );
}
