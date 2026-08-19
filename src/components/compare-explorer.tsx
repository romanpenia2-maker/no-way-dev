"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ValueFootnote } from "@/components/ui/value-footnote";
import { WeightsBadge } from "@/components/ui/weights-badge";
import { TRACKED_BENCHMARKS } from "@/lib/benchmark-keys";
import { formatPricePer1M, formatTokens, formatUsd, cn } from "@/lib/utils";

export const MAX_COMPARE = 4;
export const MIN_COMPARE = 2;

/** One column of the comparison table — serializable, assembled server-side. */
export interface CompareModel {
  slug: string;
  name: string;
  providerName: string;
  openWeights: boolean;
  contextTokens: number;
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
  /** Arena Elo per slice, aligned with the arenaLabels prop order. */
  arena: (number | undefined)[];
  /** Tracked benchmark scores, aligned with TRACKED_BENCHMARKS order. */
  benchmarks: (number | undefined)[];
  value?: number;
  monthlyCost: number;
}

export interface CompareScenario {
  requestsPerDay: number;
  inputTokens: number;
  outputTokens: number;
  cachePct: number;
}

interface Row {
  label: string;
  render: (m: CompareModel) => React.ReactNode;
  /** Section break before this row. */
  section?: string;
}

const dash = <span className="text-ink2">—</span>;

function buildRows(arenaLabels: string[], scenario: CompareScenario): Row[] {
  return [
    { label: "Provider", render: (m) => <span className="text-ink2">{m.providerName}</span> },
    {
      label: "Open/Closed",
      render: (m) => <WeightsBadge open={m.openWeights} />,
    },
    {
      label: "Price input $/1M",
      section: "Pricing",
      render: (m) => <span className="font-mono font-bold nums">{formatPricePer1M(m.inputPer1M)}</span>,
    },
    {
      label: "Price output $/1M",
      render: (m) => <span className="font-mono font-bold nums">{formatPricePer1M(m.outputPer1M)}</span>,
    },
    {
      label: "Price cached $/1M",
      render: (m) =>
        m.cachedInputPer1M !== undefined ? (
          <span className="font-mono nums">{formatPricePer1M(m.cachedInputPer1M)}</span>
        ) : (
          dash
        ),
    },
    { label: "Context", render: (m) => <span className="font-mono nums">{formatTokens(m.contextTokens)}</span> },
    ...arenaLabels.map((label, i) => ({
      label: `Arena ${label}`,
      section: i === 0 ? "Arena" : undefined,
      render: (m: CompareModel) => (m.arena[i] !== undefined ? <span className="font-mono nums">{m.arena[i]}</span> : dash),
    })),
    ...TRACKED_BENCHMARKS.map((t, i) => ({
      label: t.label,
      section: i === 0 ? "Benchmarks" : undefined,
      render: (m: CompareModel) =>
        m.benchmarks[i] !== undefined ? <span className="font-mono nums">{m.benchmarks[i].toFixed(1)}</span> : dash,
    })),
    {
      label: "Value †",
      section: "Value",
      render: (m) => (m.value !== undefined ? <span className="font-mono font-bold nums">{m.value}</span> : dash),
    },
    {
      label: `Est. monthly · ${scenario.requestsPerDay.toLocaleString("en-US")} req/day`,
      render: (m) => <span className="font-mono font-bold nums">{formatUsd(m.monthlyCost)}/mo</span>,
    },
    {
      label: "",
      render: (m) => (
        <Link
          href={`/models/${m.slug}`}
          className="font-mono text-xs uppercase tracking-[0.08em] text-ink underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
        >
          Full page →
        </Link>
      ),
    },
  ];
}

export function CompareExplorer({
  models,
  picker,
  arenaLabels,
  scenario,
}: {
  models: CompareModel[];
  picker: { slug: string; name: string }[];
  arenaLabels: string[];
  scenario: CompareScenario;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const selected = models.map((m) => m.slug);

  const toggle = useCallback(
    (slug: string) => {
      const next = selected.includes(slug)
        ? selected.filter((s) => s !== slug)
        : selected.length < MAX_COMPARE
          ? [...selected, slug]
          : selected;
      const qs = next.length ? `?models=${next.join(",")}` : "";
      router.replace(`${pathname}${qs}`, { scroll: false });
    },
    [selected, router, pathname],
  );

  const rows = buildRows(arenaLabels, scenario);
  const ready = models.length >= MIN_COMPARE;

  return (
    <div className="space-y-6">
      {/* Picker: checkbox-chips, 2–4 models */}
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">
          Models · pick {MIN_COMPARE}–{MAX_COMPARE} ·{" "}
          <span className="nums">
            {selected.length}/{MAX_COMPARE} selected
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {picker.map((p) => {
            const on = selected.includes(p.slug);
            const disabled = !on && selected.length >= MAX_COMPARE;
            return (
              <button
                key={p.slug}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => toggle(p.slug)}
                className={cn(
                  "flex min-h-11 items-center border px-3 font-mono text-xs uppercase tracking-[0.06em] sm:min-h-9",
                  on
                    ? "border-ink bg-ink text-paper"
                    : "border-ink text-ink [@media(hover:hover)]:hover:bg-ink [@media(hover:hover)]:hover:text-paper",
                  disabled && "cursor-not-allowed border-line text-ink2 opacity-50 [@media(hover:hover)]:hover:bg-transparent [@media(hover:hover)]:hover:text-ink2",
                )}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {ready ? (
        <Card className="row-fade">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 min-w-40 bg-paper">Attribute</TableHead>
                {models.map((m) => (
                  <TableHead key={m.slug} className="min-w-36">
                    <Link href={`/models/${m.slug}`} className="text-ink underline-offset-4 hover:underline">
                      {m.name}
                    </Link>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, ri) => (
                <TableRow key={ri}>
                  <TableCell className="sticky left-0 bg-paper font-mono text-[11px] uppercase tracking-[0.08em] text-ink2">
                    {row.section ? (
                      <span className="mb-1 block border-t border-ink pt-2 font-bold text-ink">{row.section}</span>
                    ) : null}
                    {row.label}
                  </TableCell>
                  {models.map((m) => (
                    <TableCell key={m.slug}>{row.render(m)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="border border-line p-8 text-center">
          <p className="font-display text-2xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
            Pick {MIN_COMPARE}–{MAX_COMPARE} models to compare
          </p>
          <p className="mt-3 text-sm text-ink2">
            Use the chips above — the URL updates so the comparison is shareable.
          </p>
        </div>
      )}

      <p className="font-mono text-[11px] leading-5 text-ink2">
        — not measured / not published · <ValueFootnote /> · est. monthly ={" "}
        {scenario.requestsPerDay.toLocaleString("en-US")} req/day × {scenario.inputTokens.toLocaleString("en-US")} in
        / {scenario.outputTokens.toLocaleString("en-US")} out tokens
        {scenario.cachePct > 0 ? ` · ${scenario.cachePct}% cached input` : ""} × 30 days.
      </p>
    </div>
  );
}
