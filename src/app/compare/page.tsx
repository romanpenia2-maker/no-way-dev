import type { Metadata } from "next";
import { CompareExplorer, MAX_COMPARE, type CompareModel, type CompareScenario } from "@/components/compare-explorer";
import { ARENA_CATEGORY_ORDER, getBenchmarksMeta } from "@/lib/data/benchmarks";
import { getAllModels, getCheapestEntry } from "@/lib/data/models";
import { getProviderName } from "@/lib/data/providers";
import { findByPrefix, TRACKED_BENCHMARKS } from "@/lib/benchmark-keys";
import { first, parseCachePct, parsePositiveInt } from "@/lib/search-params";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { site } from "@/lib/site";
import { monthlyCost, valueScore } from "@/lib/value";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseSlugs(raw: string | undefined): string[] {
  if (!raw) return [];
  const valid = new Set(getAllModels().map((m) => m.slug));
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const slug = part.trim();
    if (valid.has(slug) && !out.includes(slug)) out.push(slug);
    if (out.length >= MAX_COMPARE) break;
  }
  return out;
}

function parseScenario(sp: Record<string, string | string[] | undefined>): CompareScenario {
  return {
    requestsPerDay: parsePositiveInt(sp.rpd, 10000),
    inputTokens: parsePositiveInt(sp.in, 1000),
    outputTokens: parsePositiveInt(sp.out, 500),
    cachePct: parseCachePct(sp.cache),
  };
}

function buildCompareModels(slugs: string[], scenario: CompareScenario): CompareModel[] {
  const cacheShare = scenario.cachePct / 100;
  return slugs.flatMap((slug) => {
    const m = getAllModels().find((x) => x.slug === slug);
    if (!m) return [];
    const price = getCheapestEntry(m);
    return [
      {
        slug: m.slug,
        name: m.name,
        providerName: getProviderName(m.provider),
        openWeights: m.openWeights,
        contextTokens: m.context.tokens,
        inputPer1M: price.inputPer1M,
        outputPer1M: price.outputPer1M,
        cachedInputPer1M: price.cachedInputPer1M,
        arena: ARENA_CATEGORY_ORDER.map((cat) => m.arena?.[cat]?.elo),
        benchmarks: TRACKED_BENCHMARKS.map((t) => findByPrefix(m, t.prefix)?.score),
        value: valueScore(m.arena?.text?.elo, price.inputPer1M, price.outputPer1M),
        monthlyCost: monthlyCost(
          scenario.requestsPerDay,
          scenario.inputTokens,
          scenario.outputTokens,
          cacheShare,
          price.inputPer1M,
          price.outputPer1M,
          price.cachedInputPer1M,
        ),
      },
    ];
  });
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const slugs = parseSlugs(first(sp.models));
  const names = slugs
    .map((slug) => getAllModels().find((m) => m.slug === slug)?.name)
    .filter((n): n is string => n !== undefined);
  const title =
    names.length >= 2
      ? `${names.join(" vs ")} — API price & arena comparison`
      : "Compare LLM APIs side by side — price, context, arena";
  return {
    title,
    description: `Side-by-side comparison of LLM APIs: input/output/cached prices per 1M tokens, context windows, six arena boards, top benchmarks and value score. Pick 2–4 models.`,
    alternates: { canonical: "/compare" },
  };
}

export default async function ComparePage({ searchParams }: Props) {
  const sp = await searchParams;
  const slugs = parseSlugs(first(sp.models));
  const scenario = parseScenario(sp);
  const models = buildCompareModels(slugs, scenario);
  const meta = getBenchmarksMeta();
  const arenaLabels = ARENA_CATEGORY_ORDER.map((cat) =>
    cat === "text" ? "Overall" : meta.categories[cat].label,
  );
  const picker = getAllModels().map((m) => ({ slug: m.slug, name: m.name }));

  return (
    <div className="w-full px-4 py-12 sm:px-6 lg:px-12">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: models.length >= 2 ? `${models.map((m) => m.name).join(" vs ")} — comparison` : "LLM API comparison",
            url: `${site.url}/compare`,
            numberOfItems: models.length,
            itemListElement: models.map((m, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: m.name,
              url: `${site.url}/models/${m.slug}`,
            })),
          },
          breadcrumbJsonLd([
            { name: "Home", url: site.url },
            { name: "Compare", url: `${site.url}/compare` },
          ]),
        ]}
      />

      <div className="mb-8 max-w-2xl space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Reference / 03</p>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-5xl">
          Compare models
        </h1>
        <p className="text-[15px] leading-7 text-ink2">
          {picker.length} frontier models, side by side: prices per 1M tokens, context, six arena boards, top
          benchmarks and value score. Pick {2}–{MAX_COMPARE} models — the URL is the comparison.
        </p>
      </div>

      <CompareExplorer models={models} picker={picker} arenaLabels={arenaLabels} scenario={scenario} />
    </div>
  );
}
