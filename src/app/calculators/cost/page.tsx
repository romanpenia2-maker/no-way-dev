import type { Metadata } from "next";
import { CostCalculator } from "@/components/cost-calculator";
import { getAllPriceRows } from "@/lib/data/models";
import { getProviderNameMap } from "@/lib/data/providers";
import { parseCachePct, parsePositiveInt } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "LLM API Cost Calculator — estimate your monthly bill",
  description:
    "Enter requests per day and average token counts to compare the monthly cost of every major LLM API. Sorted table, chart of the top 10 cheapest, shareable URL.",
  alternates: { canonical: "/calculators/cost" },
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CostCalculatorPage({ searchParams }: Props) {
  const rows = getAllPriceRows();
  // SSR the scenario from ?rpd=&in=&out=&cache= (same pattern as /pricing and
  // /benchmarks) so the first paint already shows the bars and the table.
  const sp = await searchParams;
  const initial = {
    requestsPerDay: parsePositiveInt(sp.rpd, 10000),
    inputTokens: parsePositiveInt(sp.in, 1000),
    outputTokens: parsePositiveInt(sp.out, 500),
    cachePct: parseCachePct(sp.cache),
  };

  return (
    <div className="w-full px-4 py-12 sm:px-6 lg:px-12">
      <div className="mb-8 max-w-2xl space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Tool / 02</p>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-5xl">
          Cost calculator
        </h1>
        <p className="text-[15px] leading-7 text-ink2">
          Estimate the monthly bill for every model × provider combination. The URL updates as you type — share it
          to share the scenario.
        </p>
      </div>
      <CostCalculator rows={rows} providerNames={getProviderNameMap()} initial={initial} />
    </div>
  );
}
