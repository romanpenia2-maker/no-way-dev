"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { formatUsd } from "@/lib/utils";

interface CostRow extends PriceRow {
  monthlyCost: number;
}

function parseNumberParam(searchParams: URLSearchParams | null, key: string, fallback: number) {
  const raw = searchParams?.get(key);
  const parsed = raw === null || raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const tickStyle = { fontSize: 10, fill: "var(--px2)", fontFamily: "var(--font-jbmono), monospace" };

export function CostCalculator({ rows }: { rows: PriceRow[] }) {
  const searchParams = useSearchParams();
  const [requestsPerDay, setRequestsPerDay] = useState(() => parseNumberParam(searchParams, "rpd", 10000));
  const [inputTokens, setInputTokens] = useState(() => parseNumberParam(searchParams, "in", 1000));
  const [outputTokens, setOutputTokens] = useState(() => parseNumberParam(searchParams, "out", 500));
  const [copied, setCopied] = useState(false);

  const costs: CostRow[] = useMemo(() => {
    const monthlyRequests = requestsPerDay * 30;
    return rows
      .map((row) => ({
        ...row,
        monthlyCost:
          (monthlyRequests * inputTokens * row.inputPer1M) / 1_000_000 +
          (monthlyRequests * outputTokens * row.outputPer1M) / 1_000_000,
      }))
      .sort((a, b) => a.monthlyCost - b.monthlyCost);
  }, [rows, requestsPerDay, inputTokens, outputTokens]);

  const top10 = costs.slice(0, 10);

  // Keep the URL in sync so the state is shareable/bookmarkable.
  useEffect(() => {
    const params = new URLSearchParams({ rpd: String(requestsPerDay), in: String(inputTokens), out: String(outputTokens) });
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [requestsPerDay, inputTokens, outputTokens]);

  const share = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (non-secure context) — no-op
    }
  }, []);

  const fields: { label: string; value: number; set: (n: number) => void }[] = [
    { label: "Requests / day", value: requestsPerDay, set: setRequestsPerDay },
    { label: "Avg input tokens / request", value: inputTokens, set: setInputTokens },
    { label: "Avg output tokens / request", value: outputTokens, set: setOutputTokens },
  ];

  return (
    <div className="space-y-8">
      <Card className="p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {fields.map((f) => (
            <label key={f.label} className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">{f.label}</span>
              <Input
                type="number"
                min={1}
                value={f.value}
                onChange={(e) => f.set(Math.max(1, Number(e.target.value) || 1))}
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
            Top 10 cheapest — monthly cost
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">usd / month</span>
        </div>
        <div className="h-80 w-full">
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
                formatter={(value) => [formatUsd(Number(value)), "Monthly cost"]}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload as CostRow | undefined;
                  return item ? `${item.modelName} @ ${item.pricingProvider}` : "";
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
                <TableCell className="font-semibold">{row.modelName}</TableCell>
                <TableCell className="hidden text-ink2 sm:table-cell">{row.pricingProvider}</TableCell>
                <TableCell className="text-right font-mono font-bold nums">{formatUsd(row.monthlyCost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
