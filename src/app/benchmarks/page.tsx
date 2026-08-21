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

// Caveats and the "Off the boards" list live in data/meta/benchmarks.json —
// refreshing a snapshot means editing only that file.
const caveats = meta.caveats;
const offTheBoards = meta.offTheBoards;

interface Props {
  searchParams: Promise<{ cat?: string }>;
}

export default async function BenchmarksPage({ searchParams }: Props) {
  const models = getAllModels();

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
              {offTheBoards.flatMap((entry) => {
                const m = models.find((x) => x.slug === entry.slug);
                if (!m) return [];
                return [
                  <li key={entry.slug}>
                    <Link
                      href={`/models/${m.slug}`}
                      className="font-semibold text-ink underline-offset-4 hover:underline"
                    >
                      {m.name}
                    </Link>{" "}
                    {entry.text}
                  </li>,
                ];
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Sources & methodology — the link farm moved to /methodology (Phase A) */}
      <section className="border-b border-line py-12">
        <div className="flex flex-col gap-3 border border-line p-4 text-sm text-ink2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Snapshots {snapshotRange}. Every score links to its official source on the model page; vendor-run
            figures are flagged <sup className="font-bold">†</sup>. How we collect and verify the data:
          </span>
          <Link
            href="/methodology"
            className="shrink-0 font-mono text-xs uppercase tracking-[0.08em] text-ink hover:underline hover:underline-offset-4"
          >
            Methodology &amp; sources →
          </Link>
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
