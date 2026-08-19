import Link from "next/link";
import type { Metadata } from "next";
import { BenchmarksExplorer } from "@/components/benchmarks-table";
import {
  ARENA_CATEGORY_ORDER,
  DEFAULT_ARENA_CATEGORY,
  getAllCategorySlices,
  getBenchmarksMeta,
  getCategoryRows,
  getEmptyBenchmarkNotes,
  getSnapshotRangeLabel,
  isArenaCategory,
} from "@/lib/data/benchmarks";
import { getAllModels } from "@/lib/data/models";
import { formatCompact, formatDate } from "@/lib/utils";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { site } from "@/lib/site";
import type { ArenaCategory } from "@data/schemas/model.schema";

const meta = getBenchmarksMeta();
const slices = getAllCategorySlices();
const textRows = getCategoryRows("text");
const webdevRows = getCategoryRows("webdev");
const textTop = textRows[0];
const webdevTop = webdevRows[0];
const snapshotRange = getSnapshotRangeLabel();
const emptyNotes = getEmptyBenchmarkNotes();

export const metadata: Metadata = {
  title: `LLM Benchmarks & Arena Ratings: ${textTop.modelName} tops Text Arena at ${textTop.arena.elo}, ${webdevTop.modelName} leads WebDev at ${webdevTop.arena.elo}`,
  description: `Six LMArena leaderboards — Overall, WebDev, Coding, Hard Prompts, Math, Vision — next to SWE-bench Pro, Terminal-Bench, GPQA and HLE for ${getAllModels().length} frontier models. Snapshots ${snapshotRange}; every score sourced, vendor-run figures flagged.`,
  alternates: { canonical: "/benchmarks" },
};

const caveats = [
  "Qwen3.8-Max: every benchmark score is vendor-run (Alibaba official release table) — no independent measurements yet. WebDev arena rating is preliminary.",
  "DeepSeek V4 Pro: benchmarks are Artificial Analysis data via a secondary source — the official model card was not directly read. Listed prices are off-peak; peak windows bill 2×.",
  "Muse Spark 1.2: Terminal-Bench 2.1 and DeepSWE are Meta-reported; an independent Vals AI run scored 14/50 on a common scaffold — large discrepancy, treat vendor numbers with care.",
  "Mistral Medium 3.5: both benchmark scores come from aggregators, unverified against an official model card.",
  "GPT-5.6 Sol: GPQA, HLE and SWE-bench Pro figures come from Alibaba's vendor-run Qwen3.8-Max release table (cross-vendor); METR flagged high reward-hacking on the Terminal-Bench run.",
  "Claude Opus 5 Terminal-Bench 2.1: figure from Meta's vendor table — unverified for Anthropic.",
];

interface Props {
  searchParams: Promise<{ cat?: string }>;
}

export default async function BenchmarksPage({ searchParams }: Props) {
  const models = getAllModels();
  const offBoards = models.filter((m) => !m.arena || Object.keys(m.arena).length === 0);

  // Server-render the leaderboard slice matching ?cat= so the HTML always
  // contains the active table (no client-side bailout on useSearchParams).
  const { cat: rawCat } = await searchParams;
  const validCat = rawCat !== undefined && isArenaCategory(rawCat);
  const initialCat = validCat ? (rawCat as ArenaCategory) : DEFAULT_ARENA_CATEGORY;
  const invalidCat = rawCat !== undefined && !validCat;

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
            numberOfItems: textRows.length,
            itemListElement: textRows.map((r, i) => ({
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
        <h1 className="font-display text-[clamp(32px,10vw,96px)] font-extrabold uppercase leading-[0.94] tracking-[-0.03em]">
          Who&apos;s actually
          <br />
          <span className="text-outline">smarter.</span>
        </h1>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink2">
          Arena snapshots {snapshotRange} · {ARENA_CATEGORY_ORDER.length} leaderboards
        </p>
        <p className="mt-6 max-w-xl text-[15px] leading-7 text-ink2">
          Blind human preference votes across six arena boards — Overall, WebDev, Coding, Hard Prompts, Math and
          Vision — side by side with the benchmarks vendors love to quote: SWE-bench Pro, Terminal-Bench, GPQA, HLE.
          Every number links to its source; vendor-run scores are flagged.
        </p>
      </section>

      {/* Explorer: tabs + stats + leaderboard */}
      <section className="border-b border-line py-12">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
            The leaderboard
          </h2>
          <span className="font-mono text-[11px] text-ink2">
            pick a slice · sort by any column · open a row for details
          </span>
        </div>
        <BenchmarksExplorer
          slices={slices}
          initialCat={initialCat}
          invalidCat={invalidCat}
          trackedModels={models.length}
          emptyNotes={emptyNotes}
        />

        {/* Footnotes */}
        <div className="mt-10 space-y-6">
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
              Off the boards
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink2">
              {offBoards.map((m) => (
                <li key={m.slug}>
                  <Link href={`/models/${m.slug}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                    {m.name}
                  </Link>{" "}
                  —{" "}
                  {m.slug === "glm-5-3"
                    ? `released Aug 14, 2026 — too fresh for any arena board; open weights promised ~2 weeks post-launch after a safety review. No verified benchmarks published yet — ${emptyNotes[m.slug] ?? ""}`
                    : emptyNotes[m.slug]
                      ? `No verified benchmarks published yet — ${emptyNotes[m.slug]}`
                      : "not in the top-20 of any tracked arena slice."}
                </li>
              ))}
              <li>
                <Link href="/models/kimi-k3" className="font-semibold text-ink underline-offset-4 hover:underline">
                  Kimi K3
                </Link>{" "}
                has no Vision board entry;{" "}
                <Link href="/models/gpt-5-6-sol" className="font-semibold text-ink underline-offset-4 hover:underline">
                  GPT-5.6 Sol
                </Link>{" "}
                is absent from Vision and Math;{" "}
                <Link href="/models/grok-4-6" className="font-semibold text-ink underline-offset-4 hover:underline">
                  Grok 4.6
                </Link>{" "}
                appears only on WebDev (preliminary);{" "}
                <Link
                  href="/models/gemini-3-1-pro"
                  className="font-semibold text-ink underline-offset-4 hover:underline"
                >
                  Gemini 3.1 Pro
                </Link>{" "}
                and{" "}
                <Link
                  href="/models/gemini-3-6-flash"
                  className="font-semibold text-ink underline-offset-4 hover:underline"
                >
                  Gemini 3.6 Flash
                </Link>{" "}
                skip WebDev and Coding.
              </li>
            </ul>
          </div>
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
              Six LMArena leaderboards, snapshots taken {snapshotRange}. Arena Elo measures human preference, not
              benchmark accuracy — a model can top one board and lag on another. Boards:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink2">
              {ARENA_CATEGORY_ORDER.map((cat) => {
                const c = meta.categories[cat];
                return (
                  <li key={cat}>
                    <a
                      href={c.sourceUrl}
                      rel="noopener nofollow"
                      className="font-mono text-xs underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
                    >
                      {c.label} ↗
                    </a>{" "}
                    — {formatCompact(c.votes)} votes, {c.totalModels} models, snapshot {formatDate(c.snapshotAt)}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="space-y-2 border-t border-ink pt-3">
            <span className="font-mono text-xs font-bold text-ink2 nums">02</span>
            <h3 className="font-semibold">Every number has a source</h3>
            <p className="text-sm leading-6 text-ink2">
              Benchmark scores are official vendor publications unless flagged <sup className="font-bold">†</sup>.
              Per-model source links:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink2">
              {models.map((m) => {
                const urls = m.benchmarks?.length
                  ? [...new Set(m.benchmarks.map((b) => b.sourceUrl))]
                  : [m.pricing[0].sourceUrl];
                return (
                  <li key={m.slug}>
                    <Link href={`/models/${m.slug}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                      {m.name}
                    </Link>
                    :{" "}
                    {urls.map((url, i) => (
                      <span key={url}>
                        <a
                          href={url}
                          rel="noopener nofollow"
                          className="font-mono text-xs underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
                        >
                          {new URL(url).hostname.replace(/^www\./, "")} ↗
                        </a>
                        {i < urls.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </li>
                );
              })}
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
