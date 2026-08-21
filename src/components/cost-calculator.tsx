"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { OffPeakFootnote, OffPeakMark } from "@/components/ui/off-peak-footnote";
import type { PriceRow } from "@/lib/data/models";
import { cn, formatUsd, isOffPeakNote } from "@/lib/utils";

interface CostRow extends PriceRow {
  monthlyCost: number;
}

/** Never render "$∞" — fall back to an em dash for non-finite amounts. */
function safeFormatUsd(value: number): string {
  return Number.isFinite(value) ? formatUsd(value) : "—";
}

function buildResultColumns(providerNames: Record<string, string>): DataColumn<CostRow>[] {
  return [
    {
      key: "model",
      label: "Model",
      sortValue: (row) => row.modelName,
      render: (row) => (
        <>
          <Link href={`/models/${row.modelSlug}`} className="font-semibold underline-offset-4 hover:underline">
            {row.modelName}
          </Link>
          {isOffPeakNote(row.note) ? <OffPeakMark /> : null}
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
      key: "cost",
      label: "Monthly cost",
      numeric: true,
      ascByDefault: true,
      sortValue: (row) => row.monthlyCost,
      render: (row) => <span className="font-bold">{safeFormatUsd(row.monthlyCost)}</span>,
      exportValue: (row) => safeFormatUsd(row.monthlyCost),
    },
  ];
}

/** E-ink CSS bars: horizontal divs, width % of the max, mono figures on the right. */
function CostBars({ rows, providerNames }: { rows: CostRow[]; providerNames: Record<string, string> }) {
  // Rows arrive sorted cheapest-first — scale against the largest finite cost,
  // never rows[0], otherwise every bar overflows the card.
  const max = rows.reduce(
    (m, row) => (Number.isFinite(row.monthlyCost) && row.monthlyCost > m ? row.monthlyCost : m),
    0,
  );
  return (
    <ul
      className="min-w-0 space-y-2 overflow-hidden"
      role="img"
      aria-label="Bar chart of the top cheapest models by monthly cost"
    >
      {rows.map((row, i) => {
        const pct =
          max > 0 && Number.isFinite(row.monthlyCost) ? Math.min(100, (row.monthlyCost / max) * 100) : 0;
        return (
          <li
            key={`${row.modelSlug}-${row.pricingProvider}`}
            className={cn("flex items-center gap-3", i >= 6 && "hidden sm:flex")}
          >
            <span className="w-36 min-w-0 shrink-0 truncate font-mono text-[11px] nums sm:w-48">
              <span className="mr-1.5 text-ink2">{String(i + 1).padStart(2, "0")}</span>
              {row.modelName}
              <span className="ml-1 text-ink2">
                @ {providerNames[row.pricingProvider] ?? row.pricingProvider}
              </span>
            </span>
            <span className="h-4 min-w-0 flex-1 overflow-hidden" aria-hidden>
              <span
                className="block h-full bg-ink motion-safe:transition-[width]"
                style={{ width: `${pct}%`, opacity: Math.max(0.4, 1 - i * 0.07) }}
              />
            </span>
            <span className="w-20 shrink-0 text-right font-mono text-[13px] font-bold nums">
              {safeFormatUsd(row.monthlyCost)}/mo
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export interface CostScenario {
  requestsPerDay: number;
  inputTokens: number;
  outputTokens: number;
  cachePct: number;
}

export function CostCalculator({
  rows,
  providerNames,
  initial,
}: {
  rows: PriceRow[];
  providerNames: Record<string, string>;
  /** Scenario parsed server-side from the URL (?rpd=&in=&out=&cache=). */
  initial: CostScenario;
}) {
  const [requestsPerDay, setRequestsPerDay] = useState(initial.requestsPerDay);
  const [inputTokens, setInputTokens] = useState(initial.inputTokens);
  const [outputTokens, setOutputTokens] = useState(initial.outputTokens);
  const [cachePct, setCachePct] = useState(initial.cachePct);
  const [copied, setCopied] = useState(false);

  const costs: CostRow[] = useMemo(() => {
    const monthlyRequests = requestsPerDay * 30;
    const cacheShare = cachePct / 100;
    return rows
      .map((row) => {
        // Cached share of input bills at the cached rate where one is published.
        const effectiveInput =
          (1 - cacheShare) * row.inputPer1M + cacheShare * (row.cachedInputPer1M ?? row.inputPer1M);
        return {
          ...row,
          monthlyCost:
            (monthlyRequests * inputTokens * effectiveInput) / 1_000_000 +
            (monthlyRequests * outputTokens * row.outputPer1M) / 1_000_000,
        };
      })
      .sort((a, b) => a.monthlyCost - b.monthlyCost);
  }, [rows, requestsPerDay, inputTokens, outputTokens, cachePct]);

  const top10 = costs.slice(0, 10);

  // Keep the URL in sync so the state is shareable/bookmarkable.
  useEffect(() => {
    const params = new URLSearchParams({ rpd: String(requestsPerDay), in: String(inputTokens), out: String(outputTokens) });
    if (cachePct > 0) params.set("cache", String(cachePct));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [requestsPerDay, inputTokens, outputTokens, cachePct]);

  const share = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (non-secure context) — no-op
    }
  }, []);

  const fields: { label: string; value: number; set: (n: number) => void; min: number; max?: number }[] = [
    { label: "Requests / day", value: requestsPerDay, set: setRequestsPerDay, min: 1 },
    { label: "Avg input tokens / request", value: inputTokens, set: setInputTokens, min: 1 },
    { label: "Avg output tokens / request", value: outputTokens, set: setOutputTokens, min: 1 },
    { label: "Cached input %", value: cachePct, set: setCachePct, min: 0, max: 90 },
  ];

  return (
    <div className="space-y-8">
      <Card className="p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((f) => (
            <label key={f.label} className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">{f.label}</span>
              <Input
                type="number"
                min={f.min}
                max={f.max}
                value={f.value}
                onChange={(e) => {
                  const n = Number(e.target.value) || 0;
                  f.set(Math.min(f.max ?? Infinity, Math.max(f.min, n)));
                }}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-ink2 nums">
            {requestsPerDay.toLocaleString("en-US")} req/day × 30 days ={" "}
            <span className="font-bold text-ink">{(requestsPerDay * 30).toLocaleString("en-US")} requests/month</span>
          </p>
          <Button variant="outline" size="sm" onClick={share}>
            {copied ? "Copied!" : "Copy share link"}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold uppercase leading-[0.94] tracking-[-0.02em]">
            Top cheapest — monthly cost
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">usd / month</span>
        </div>
        {/* CSS bars: top-10, collapsing to top-6 on mobile */}
        <CostBars rows={top10} providerNames={providerNames} />
      </Card>

      <DataTable
        rows={costs}
        columns={buildResultColumns(providerNames)}
        rowKey={(row) => `${row.modelSlug}-${row.pricingProvider}`}
        mobileMode="table"
        sortable={false}
        withExport={false}
        sortSelectId="cost-sort"
        cardFooter={<OffPeakFootnote rows={costs} className="border-t border-line px-3 py-2" />}
      />

      <p className="font-mono text-[11px] leading-5 text-ink2">
        Excludes batch/volume discounts and tiered pricing (DeepSeek peak ×2, long-context tiers). Cached rate
        applied where published.
      </p>
    </div>
  );
}
