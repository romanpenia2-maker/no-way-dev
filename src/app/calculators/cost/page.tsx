import { Suspense } from "react";
import type { Metadata } from "next";
import { CostCalculator } from "@/components/cost-calculator";
import { getAllPriceRows } from "@/lib/data/models";
import { getProviderNameMap } from "@/lib/data/providers";

export const metadata: Metadata = {
  title: "LLM API Cost Calculator — estimate your monthly bill",
  description:
    "Enter requests per day and average token counts to compare the monthly cost of every major LLM API. Sorted table, chart of the top 10 cheapest, shareable URL.",
  alternates: { canonical: "/calculators/cost" },
};

export default function CostCalculatorPage() {
  const rows = getAllPriceRows();

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
      <Suspense fallback={null}>
        <CostCalculator rows={rows} providerNames={getProviderNameMap()} />
      </Suspense>
    </div>
  );
}
