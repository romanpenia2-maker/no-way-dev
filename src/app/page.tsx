import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmailCapture } from "@/components/email-capture";
import { getAllModels, getAllPriceRows, getCheapestPriceRows } from "@/lib/data/models";
import { getProviderName } from "@/lib/data/providers";
import { formatDate, formatPricePer1M, formatTokens } from "@/lib/utils";
import { JsonLd, websiteJsonLd } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "AI API Pricing Reference — compare LLM API prices across providers",
  description:
    "Live reference of LLM API prices per 1M tokens: OpenAI, Anthropic, Google, DeepSeek and more. Cost calculator, verified data, weekly updates.",
  alternates: { canonical: "/" },
};

const tools = [
  {
    href: "/pricing",
    label: "T/01",
    title: "Pricing",
    description: "Full table of model × provider prices per 1M tokens. Sort, filter by capability, check freshness.",
  },
  {
    href: "/calculators/cost",
    label: "T/02",
    title: "Calculator",
    description: "Plug in your traffic — requests per day and token volumes — and get the monthly bill per model.",
  },
  {
    href: "/guides",
    label: "T/03",
    title: "Guides",
    description: "Practical guides: how to compare API pricing, cut costs with caching, pick a model for a task.",
  },
];

const howItWorks = [
  {
    title: "Data lives in git",
    text: "Every model and price is a JSON file in a public repo. Full history, diffs and review via pull requests.",
  },
  {
    title: "Weekly bots",
    text: "Automated jobs re-check official pricing pages every week and open PRs with changes — humans approve.",
  },
  {
    title: "Every number has a source",
    text: "Each price links to the official provider page and carries an updatedAt date. No unsourced numbers, ever.",
  },
];

export default function HomePage() {
  const cheapest = getCheapestPriceRows(5);
  const models = getAllModels();
  const allRows = getAllPriceRows();

  const minInput = Math.min(...allRows.map((r) => r.inputPer1M));
  const maxContext = Math.max(...models.map((m) => m.context.tokens));
  const providerCount = new Set(allRows.map((r) => r.pricingProvider)).size;
  const lastUpdated = allRows.map((r) => r.updatedAt).sort().at(-1);

  const stats = [
    { label: "Models tracked", value: String(models.length).padStart(2, "0"), trend: "▲ open + closed weights" },
    { label: "Min input $/1M", value: formatPricePer1M(minInput), trend: "▼ cheapest verified rate" },
    { label: "Max context", value: formatTokens(maxContext), trend: "▲ tokens in one window" },
    { label: "Providers", value: String(providerCount).padStart(2, "0"), trend: "▲ official sources only" },
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-12">
      <JsonLd data={websiteJsonLd()} />

      {/* Hero */}
      <section className="border-b border-line py-14 sm:py-20">
        <h1 className="font-display text-[clamp(40px,9vw,96px)] font-extrabold uppercase leading-[0.94] tracking-[-0.03em]">
          Read the market
          <br />
          <span className="text-outline">like paper.</span>
        </h1>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink2">
          Registry {models.length} models · Refresh weekly · Sponsored none
        </p>
        <p className="mt-6 max-w-xl text-[15px] leading-7 text-ink2">
          Every major LLM API — input, output and cached-token prices per 1M tokens, context windows and
          capabilities. Verified against official pages, refreshed weekly, free forever.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="inline-flex h-10 items-center bg-ink px-6 font-mono text-xs font-bold uppercase tracking-[0.08em] text-paper hover:bg-ink/90"
          >
            Browse pricing
          </Link>
          <Link
            href="/calculators/cost"
            className="inline-flex h-10 items-center border border-ink px-6 font-mono text-xs font-bold uppercase tracking-[0.08em] hover:bg-ink hover:text-paper"
          >
            Estimate my bill
          </Link>
        </div>
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

      {/* Top-5 cheapest */}
      <section className="border-b border-line py-12">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
            Cheapest right now
          </h2>
          <span className="font-mono text-[11px] text-ink2">
            updated {lastUpdated ? formatDate(lastUpdated) : "—"}
          </span>
        </div>
        <Card className="row-fade">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="hidden sm:table-cell">Provider</TableHead>
                <TableHead className="text-right">Input $/1M</TableHead>
                <TableHead className="text-right">Output $/1M</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cheapest.map((row, i) => (
                <TableRow key={`${row.modelSlug}-${row.pricingProvider}`} className="cursor-pointer">
                  <TableCell className="font-mono text-xs text-ink2 nums">
                    {String(i + 1).padStart(2, "0")}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/models/${row.modelSlug}`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {row.modelName}
                    </Link>{" "}
                    <Badge variant={row.openWeights ? "outline" : "solid"} className="ml-1 align-middle">
                      {row.openWeights ? "Open" : "Closed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-ink2 sm:table-cell">
                    {getProviderName(row.pricingProvider)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold nums">
                    {formatPricePer1M(row.inputPer1M)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold nums">
                    {formatPricePer1M(row.outputPer1M)}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono text-ink2 nums sm:table-cell">
                    {formatTokens(row.contextTokens)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <div className="mt-3 text-right">
          <Link
            href="/pricing"
            className="font-mono text-xs uppercase tracking-[0.08em] hover:underline hover:underline-offset-4"
          >
            Full table →
          </Link>
        </div>
      </section>

      {/* Tools */}
      <section className="border-b border-line py-12">
        <h2 className="mb-6 font-display text-2xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {tools.map((t) => (
            <Link key={t.href} href={t.href} className="group">
              <Card className="h-full group-hover:bg-ink group-hover:text-paper [&_*]:group-hover:text-paper">
                <CardHeader>
                  <p className="border-t border-ink pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2 group-hover:border-paper">
                    {t.label}
                  </p>
                  <CardTitle>{t.title}</CardTitle>
                  <CardDescription>{t.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-line py-12">
        <h2 className="mb-6 font-display text-2xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
          How it works
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {howItWorks.map((s, i) => (
            <div key={s.title} className="space-y-2 border-t border-ink pt-3">
              <span className="font-mono text-xs font-bold text-ink2 nums">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm leading-6 text-ink2">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Email capture */}
      <section className="py-12 sm:py-16">
        <div className="border border-ink p-6 sm:p-10">
          <div className="space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Digest</p>
            <h2 className="font-display text-2xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
              Price-change digest
            </h2>
            <p className="max-w-lg text-sm text-ink2">
              One short email when a major provider changes API prices. No spam, unsubscribe anytime.
            </p>
            <EmailCapture />
          </div>
        </div>
      </section>
    </div>
  );
}
