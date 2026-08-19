import Link from "next/link";
import type { Metadata } from "next";
import { BenchmarksTable } from "@/components/benchmarks-table";
import { getBenchmarksMeta, getLeaderboardRows, getUniqueBenchmarkCount } from "@/lib/data/benchmarks";
import { getAllModels } from "@/lib/data/models";
import { formatDate } from "@/lib/utils";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { site } from "@/lib/site";

const rows = getLeaderboardRows();
const meta = getBenchmarksMeta();
const top = rows[0];
const benchmarkCount = getUniqueBenchmarkCount();

export const metadata: Metadata = {
  title: `LLM Benchmarks & Arena Ratings: ${top.modelName} leads at ${top.elo} Elo — no-way.dev`,
  description: `LMArena-style leaderboard for ${rows.length} frontier models: Arena Elo, SWE-bench Verified, GPQA Diamond, AIME 2025, LiveCodeBench, MMMU and HLE — every score sourced. Snapshot ${formatDate(meta.snapshotAt)}, ${meta.votes} votes.`,
  alternates: { canonical: "/benchmarks" },
};

const caveats = [
  "Qwen3 Max: all benchmark scores are vendor self-reported (Qwen), collected via the llm-stats aggregator — not independent measurements.",
  "Grok 4 SWE-bench Verified: third-party aggregators only, medium reliability — xAI did not publish an official SWE-bench score.",
  "GPT-5 mini LiveCodeBench v6 and MMLU-Pro: third-party measurement by LG AI (reasoning: high), not official OpenAI numbers.",
];

const variantNotes = rows
  .filter((r) => r.arenaVariant || r.arenaNote)
  .map((r) => ({
    name: r.modelName,
    variant: r.arenaVariant,
    note: r.arenaNote,
  }));

const llamaNote = rows.find((r) => r.modelSlug === "llama-4-maverick")?.arenaNote;

export default function BenchmarksPage() {
  const models = getAllModels();

  const stats = [
    { label: "Models rated", value: String(rows.length).padStart(2, "0"), trend: "▲ ranked by arena elo" },
    { label: "Top arena elo", value: String(top.elo), trend: `▲ ${top.modelName}` },
    { label: "Benchmarks tracked", value: String(benchmarkCount), trend: "▲ every score sourced" },
    { label: "Snapshot", value: formatDate(meta.snapshotAt), trend: `▲ ${meta.votes} votes` },
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-12">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "LLM Benchmarks & Arena Ratings",
            description: metadata.description ?? undefined,
            url: `${site.url}/benchmarks`,
            numberOfItems: rows.length,
            itemListElement: rows.map((r, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: r.modelName,
              url: `${site.url}/models/${r.modelSlug}`,
            })),
          },
          breadcrumbJsonLd([
            { name: "Home", url: site.url },
            { name: "Benchmarks", url: `${site.url}/benchmarks` },
          ]),
        ]}
      />

      {/* Hero */}
      <section className="border-b border-line py-14 sm:py-20">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Reference / 02</p>
        <h1 className="font-display text-[clamp(40px,9vw,96px)] font-extrabold uppercase leading-[0.94] tracking-[-0.03em]">
          Who&apos;s actually
          <br />
          <span className="text-outline">smarter.</span>
        </h1>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink2">
          Arena snapshot {meta.snapshotAt} · {meta.votes} votes · {meta.totalModels} models
        </p>
        <p className="mt-6 max-w-xl text-[15px] leading-7 text-ink2">
          Arena Elo from {meta.votes} blind human votes, side by side with the benchmarks vendors love to quote —
          SWE-bench, GPQA, AIME, LiveCodeBench, MMMU, HLE. Every number links to its source; self-reported scores
          are flagged.
        </p>
      </section>

      {/* Stats strip */}
      <section className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={
              "space-y-2 py-6 pr-4 " +
              (i > 0 ? "border-l border-line pl-4 " : "") +
              (i === 2 ? "max-sm:border-l-0 max-sm:pl-0" : "")
            }
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">{s.label}</p>
            <p className="font-mono text-3xl font-bold leading-none nums sm:text-4xl">{s.value}</p>
            <p className="font-mono text-[11px] text-ink2">{s.trend}</p>
          </div>
        ))}
      </section>

      {/* Leaderboard */}
      <section className="border-b border-line py-12">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
            The leaderboard
          </h2>
          <span className="font-mono text-[11px] text-ink2">
            sorted by arena elo · click a column to re-sort
          </span>
        </div>
        <BenchmarksTable rows={rows} />
        <p className="mt-3 font-mono text-[11px] text-ink2">
          — not measured / not published · <sup className="font-bold">†</sup> score has a caveat — hover the cell
          for details, see footnotes below.
        </p>

        {/* Footnotes */}
        <div className="mt-8 space-y-6">
          <div className="space-y-2 border-t border-ink pt-3">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
              Caveats <sup className="font-bold">†</sup>
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink2">
              {caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 border-t border-ink pt-3">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
              Arena variants
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink2">
              {variantNotes.map((v) => (
                <li key={v.name}>
                  <span className="font-semibold text-ink">{v.name}</span>
                  {v.variant ? (
                    <>
                      {" "}
                      rated as <span className="font-mono text-[13px]">{v.variant}</span>
                    </>
                  ) : null}
                  {v.note ? `. ${v.note}.` : "."}
                </li>
              ))}
            </ul>
          </div>

          {llamaNote ? (
            <div className="border border-ink p-4 sm:p-6">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                The Llama 4 «Leaderboard Illusion»
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink2">{llamaNote}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Sources & methodology */}
      <section className="border-b border-line py-12">
        <h2 className="mb-6 font-display text-2xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
          Sources &amp; methodology
        </h2>
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-2 border-t border-ink pt-3">
            <span className="font-mono text-xs font-bold text-ink2 nums">01</span>
            <h3 className="font-semibold">Arena ratings</h3>
            <p className="text-sm leading-6 text-ink2">
              {meta.note}: {meta.votes} blind pairwise votes across {meta.totalModels} models, snapshot{" "}
              {formatDate(meta.snapshotAt)}. Arena Elo measures human preference in chat, not benchmark accuracy —
              a model can top one board and lag on the other.{" "}
              <a
                href={meta.sourceUrl}
                rel="noopener nofollow"
                className="font-mono text-xs underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
              >
                arena leaderboard ↗
              </a>
            </p>
          </div>
          <div className="space-y-2 border-t border-ink pt-3">
            <span className="font-mono text-xs font-bold text-ink2 nums">02</span>
            <h3 className="font-semibold">Every number has a source</h3>
            <p className="text-sm leading-6 text-ink2">
              Benchmark scores are official vendor publications unless flagged <sup className="font-bold">†</sup>.
              Per-model source links:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink2">
              {models.map((m) =>
                m.benchmarks?.length ? (
                  <li key={m.slug}>
                    <Link href={`/models/${m.slug}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                      {m.name}
                    </Link>
                    :{" "}
                    {[...new Set(m.benchmarks.map((b) => b.sourceUrl))].map((url, i, arr) => (
                      <span key={url}>
                        <a
                          href={url}
                          rel="noopener nofollow"
                          className="font-mono text-xs underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
                        >
                          {new URL(url).hostname.replace(/^www\./, "")} ↗
                        </a>
                        {i < arr.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12">
        <div className="flex flex-col gap-3 border border-line p-4 text-sm text-ink2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Benchmarks don&apos;t pay the bills — prices do. Compare what these models cost per 1M tokens.
          </span>
          <Link
            href="/pricing"
            className="shrink-0 font-mono text-xs uppercase tracking-[0.08em] text-ink hover:underline hover:underline-offset-4"
          >
            Browse API pricing →
          </Link>
        </div>
      </section>
    </div>
  );
}
