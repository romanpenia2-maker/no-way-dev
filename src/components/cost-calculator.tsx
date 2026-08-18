"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
            <label key={f.label} className="space-y-1.5 text-sm font-medium">
              {f.label}
              <Input
                type="number"
                min={1}
                value={f.value}
                onChange={(e) => f.set(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {requestsPerDay.toLocaleString("en-US")} req/day × 30 days ={" "}
            {(requestsPerDay * 30).toLocaleString("en-US")} requests/month
          </p>
          <Button variant="outline" size="sm" onClick={share}>
            {copied ? "Copied!" : "Copy share link"}
          </Button>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Top 10 cheapest — monthly cost</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top10} margin={{ top: 4, right: 8, bottom: 60, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="modelName"
                angle={-35}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
              />
              <Tooltip
                formatter={(value) => [formatUsd(Number(value)), "Monthly cost"]}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload as CostRow | undefined;
                  return item ? `${item.modelName} @ ${item.pricingProvider}` : "";
                }}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  color: "hsl(var(--foreground))",
                }}
              />
              <Bar dataKey="monthlyCost" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead className="text-right">Monthly cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costs.map((row, i) => (
              <TableRow key={`${row.modelSlug}-${row.pricingProvider}`}>
                <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">{row.modelName}</TableCell>
                <TableCell className="text-muted-foreground">{row.pricingProvider}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatUsd(row.monthlyCost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
