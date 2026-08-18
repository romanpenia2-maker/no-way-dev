import { Suspense } from "react";
import type { Metadata } from "next";
import { CostCalculator } from "@/components/cost-calculator";
import { getAllPriceRows } from "@/lib/data/models";

export const metadata: Metadata = {
  title: "LLM API Cost Calculator — estimate your monthly bill",
  description:
    "Enter requests per day and average token counts to compare the monthly cost of every major LLM API. Sorted table, chart of the top 10 cheapest, shareable URL.",
  alternates: { canonical: "/calculators/cost" },
};

export default function CostCalculatorPage() {
  const rows = getAllPriceRows();

  return (
    <div className="mx-auto w-full max-w-content px-4 py-12 sm:px-6">
      <div className="mb-8 max-w-2xl space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Cost calculator</h1>
        <p className="text-muted-foreground">
          Estimate the monthly bill for every model × provider combination. The URL updates as you type — share it
          to share the scenario.
        </p>
      </div>
      <Suspense fallback={null}>
        <CostCalculator rows={rows} />
      </Suspense>
    </div>
  );
}
