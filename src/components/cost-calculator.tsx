"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PriceRow } from "@/lib/data/models";
import { formatUsd, isOffPeakNote } from "@/lib/utils";

interface CostRow extends PriceRow {
  monthlyCost: number;
}

/** Cap URL-provided volumes so crafted links can't produce absurd/overflowing numbers. */
const MAX_PARAM = 1e9;

function parseNumberParam(searchParams: URLSearchParams | null, key: string, fallback: number) {
  const raw = searchParams?.get(key);
  const parsed = raw === null || raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_PARAM);
}

/** Cached-input share, percent 0–90 (0 is a valid value, unlike the volume params). */
function parseCacheParam(searchParams: URLSearchParams | null): number {
  const raw = searchParams?.get("cache");
  const parsed = raw === null || raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 90) return 0;
  return parsed;
}

/** Never render "$∞" — fall back to an em dash for non-finite amounts. */
function safeFormatUsd(value: number): string {
  return Number.isFinite(value) ? formatUsd(value) : "—";
}

const tickStyle = { fontSize: 10, fill: "var(--px2)", fontFamily: "var(--font-jbmono), monospace" };

export function CostCalculator({
  rows,
  providerNames,
}: {
  rows: PriceRow[];
  providerNames: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const [requestsPerDay, setRequestsPerDay] = useState(() => parseNumberParam(searchParams, "rpd", 10000));
  const [inputTokens, setInputTokens] = useState(() => parseNumberParam(searchParams, "in", 1000));
  const [outputTokens, setOutputTokens] = useState(() => parseNumberParam(searchParams, "out", 500));
  const [cachePct, setCachePct] = useState(() => parseCacheParam(searchParams));
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
  const top6 = costs.slice(0, 6);
  const hasOffPeak = costs.some((row) => isOffPeakNote(row.note));

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

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold uppercase leading-[0.94] tracking-[-0.02em]">
            Top cheapest — monthly cost
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">usd / month</span>
        </div>
        {/* Mobile: compact top-6 list instead of the chart */}
        <ul className="divide-y divide-line sm:hidden">
          {top6.map((row, i) => (
            <li
              key={`${row.modelSlug}-${row.pricingProvider}`}
              className="flex items-baseline justify-between gap-3 py-2 font-mono text-[13px] nums"
            >
              <span className="min-w-0 truncate">
                <span className="mr-2 text-ink2">{String(i + 1).padStart(2, "0")}</span>
                {row.modelName}
                <span className="ml-1 text-[11px] text-ink2">@ {providerNames[row.pricingProvider] ?? row.pricingProvider}</span>
              </span>
              <span className="shrink-0 font-bold">{safeFormatUsd(row.monthlyCost)}/mo</span>
            </li>
          ))}
        </ul>
        <div className="hidden h-80 w-full sm:block">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top10} margin={{ top: 4, right: 8, bottom: 60, left: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="modelName"
                angle={-35}
                textAnchor="end"
                interval={0}
                tick={tickStyle}
                axisLine={{ stroke: "var(--px)" }}
                tickLine={{ stroke: "var(--px)" }}
              />
              <YAxis
                tick={tickStyle}
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
                axisLine={{ stroke: "var(--px)" }}
                tickLine={{ stroke: "var(--px)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--px)", fillOpacity: 0.08 }}
                formatter={(value) => [safeFormatUsd(Number(value)), "Monthly cost"]}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload as CostRow | undefined;
                  return item
                    ? `${item.modelName} @ ${providerNames[item.pricingProvider] ?? item.pricingProvider}`
                    : "";
                }}
                contentStyle={{
                  backgroundColor: "var(--paper)",
                  border: "1px solid var(--px)",
                  borderRadius: 0,
                  color: "var(--px)",
                  fontFamily: "var(--font-jbmono), monospace",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="monthlyCost" fill="var(--px)" radius={0}>
                {top10.map((_, i) => (
                  <Cell key={i} fillOpacity={Math.max(0.4, 1 - i * 0.07)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="row-fade">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="hidden sm:table-cell">Provider</TableHead>
              <TableHead className="text-right">Monthly cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costs.map((row, i) => (
              <TableRow key={`${row.modelSlug}-${row.pricingProvider}`}>
                <TableCell className="font-mono text-xs text-ink2 nums">
                  {String(i + 1).padStart(2, "0")}
                </TableCell>
                <TableCell className="font-semibold">
                  <Link
                    href={`/models/${row.modelSlug}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {row.modelName}
                  </Link>
                  {isOffPeakNote(row.note) ? (
                    <sup className="ml-0.5 font-bold" title="Off-peak rate; peak windows bill 2×">
                      †
                    </sup>
                  ) : null}
                </TableCell>
                <TableCell className="hidden text-ink2 sm:table-cell">
                  {providerNames[row.pricingProvider] ?? row.pricingProvider}
                </TableCell>
                <TableCell className="text-right font-mono font-bold nums">{safeFormatUsd(row.monthlyCost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {hasOffPeak ? (
          <p className="border-t border-line px-3 py-2 font-mono text-[11px] text-ink2">
            <sup className="font-bold">†</sup> off-peak rate; peak windows bill 2×
          </p>
        ) : null}
      </Card>

      <p className="font-mono text-[11px] leading-5 text-ink2">
        Excludes batch/volume discounts and tiered pricing (DeepSeek peak ×2, long-context tiers). Cached rate
        applied where published.
      </p>
    </div>
  );
}
