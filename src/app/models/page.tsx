import Link from "next/link";
import type { Metadata } from "next";
import { getAllModels } from "@/lib/data/models";
import { getProviderName } from "@/lib/data/providers";

export const metadata: Metadata = {
  title: "All tracked LLM models",
  description:
    "Every LLM tracked by no-way.dev: context window, API price per 1M tokens, arena rating and capabilities — each entry links to a sourced model page.",
  alternates: { canonical: "/models" },
};

function fmtCtx(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  return `${Math.round(tokens / 1000)}K`;
}

export default function ModelsIndexPage() {
  const models = getAllModels().slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full px-4 py-12 sm:px-6 lg:px-12">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Registry</p>
      <h1 className="mb-3 font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-5xl">
        Models
      </h1>
      <p className="mb-10 max-w-2xl text-[15px] leading-7 text-ink2">
        {models.length} models tracked. Every price carries a source link and a last-checked date on the
        model page.
      </p>

      <div className="overflow-x-auto border border-line" tabIndex={0} role="region" aria-label="Models registry — scrollable table">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">Model</th>
              <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">Provider</th>
              <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">Context</th>
              <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">In $/1M</th>
              <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">Out $/1M</th>
              <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">Text arena</th>
              <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">Status</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const price = m.pricing[0];
              return (
                <tr key={m.slug} className="border-b border-line last:border-0 hover:bg-ink hover:text-paper [&:hover_*]:text-paper">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">
                    <Link href={`/models/${m.slug}`} className="text-ink underline-offset-4 hover:underline">
                      {m.name}
                    </Link>
                    {m.openWeights && <span className="ml-1 font-mono text-[10px] text-ink2">open</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink2">{getProviderName(m.provider)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-ink2">{fmtCtx(m.context.tokens)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-ink2">
                    {price ? `$${price.inputPer1M}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-ink2">
                    {price ? `$${price.outputPer1M}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-ink2">
                    {m.arena?.text ? `${m.arena.text.elo} · #${m.arena.text.rank}` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] uppercase text-ink2">{m.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
