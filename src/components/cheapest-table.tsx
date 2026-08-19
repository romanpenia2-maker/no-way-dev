"use client";

import Link from "next/link";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { OffPeakMark } from "@/components/ui/off-peak-footnote";
import { WeightsBadge } from "@/components/ui/weights-badge";
import type { PriceRow } from "@/lib/data/models";
import { formatPricePer1M, formatTokens, isOffPeakNote } from "@/lib/utils";

function buildColumns(providerNames: Record<string, string>): DataColumn<PriceRow>[] {
  return [
    {
      key: "model",
      label: "Model",
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
      hideBelowSm: true,
      sortValue: (row) => providerNames[row.pricingProvider] ?? row.pricingProvider,
      render: (row) => <span className="text-ink2">{providerNames[row.pricingProvider] ?? row.pricingProvider}</span>,
      exportValue: (row) => providerNames[row.pricingProvider] ?? row.pricingProvider,
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
      hideBelowSm: true,
      ascByDefault: true,
      sortValue: (row) => row.contextTokens,
      render: (row) => <span className="text-ink2">{formatTokens(row.contextTokens)}</span>,
      exportValue: (row) => formatTokens(row.contextTokens),
    },
  ];
}

/** Home "Cheapest right now" table — static order (cheapest first), no sort UI. */
export function CheapestTable({
  rows,
  providerNames,
}: {
  rows: PriceRow[];
  providerNames: Record<string, string>;
}) {
  return (
    <DataTable
      rows={rows}
      columns={buildColumns(providerNames)}
      rowKey={(row) => `${row.modelSlug}-${row.pricingProvider}`}
      mobileMode="table"
      sortable={false}
      withExport={false}
      sortSelectId="cheapest-sort"
    />
  );
}
