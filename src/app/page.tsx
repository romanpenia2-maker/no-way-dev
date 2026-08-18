import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmailCapture } from "@/components/email-capture";
import { getCheapestPriceRows } from "@/lib/data/models";
import { getProviderName } from "@/lib/data/providers";
import { formatPricePer1M, formatTokens } from "@/lib/utils";
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
    title: "Pricing",
    description: "Full table of model × provider prices per 1M tokens. Sort, filter by capability, check freshness.",
  },
  {
    href: "/calculators/cost",
    title: "Calculator",
    description: "Plug in your traffic — requests per day and token volumes — and get the monthly bill per model.",
  },
  {
    href: "/guides",
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

  return (
    <div className="mx-auto w-full max-w-content px-4 sm:px-6">
      <JsonLd data={websiteJsonLd()} />

      {/* Hero */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl space-y-5">
          <Badge>Updated weekly · sources linked</Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            AI API pricing, without the digging
          </h1>
          <p className="text-lg text-muted-foreground">
            Every major LLM API — input, output and cached-token prices per 1M tokens, context windows and
            capabilities. Verified against official pages, refreshed weekly, free forever.
          </p>
          <div className="flex gap-3 pt-1">
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground hover:bg-accent/90"
            >
              Browse pricing
            </Link>
            <Link
              href="/calculators/cost"
              className="inline-flex h-10 items-center rounded-md border border-border px-6 text-sm font-medium hover:bg-muted"
            >
              Estimate my bill
            </Link>
          </div>
        </div>
      </section>

      {/* Top-5 cheapest */}
      <section className="pb-16">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Cheapest right now</h2>
          <Link href="/pricing" className="text-sm text-accent hover:underline">
            Full table →
          </Link>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Input $/1M</TableHead>
                <TableHead className="text-right">Output $/1M</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cheapest.map((row) => (
                <TableRow key={`${row.modelSlug}-${row.pricingProvider}`}>
                  <TableCell className="font-medium">
                    <Link href={`/models/${row.modelSlug}`} className="hover:text-accent hover:underline">
                      {row.modelName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{getProviderName(row.pricingProvider)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPricePer1M(row.inputPer1M)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPricePer1M(row.outputPer1M)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                    {formatTokens(row.contextTokens)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Tools */}
      <section className="pb-16">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {tools.map((t) => (
            <Link key={t.href} href={t.href} className="group">
              <Card className="h-full transition-colors group-hover:border-accent/60">
                <CardHeader>
                  <CardTitle className="group-hover:text-accent">{t.title}</CardTitle>
                  <CardDescription>{t.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="pb-16">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">How it works</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {howItWorks.map((s, i) => (
            <div key={s.title} className="space-y-2">
              <span className="text-sm font-semibold tabular-nums text-accent">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-medium">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Email capture */}
      <section className="pb-20">
        <Card className="p-6 sm:p-10">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Price-change digest</h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              One short email when a major provider changes API prices. No spam, unsubscribe anytime.
            </p>
            <EmailCapture />
          </div>
        </Card>
      </section>
    </div>
  );
}
