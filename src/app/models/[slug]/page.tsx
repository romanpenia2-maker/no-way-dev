import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllModels, getModel } from "@/lib/data/models";
import { getProvider } from "@/lib/data/providers";
import { formatDate, formatPricePer1M, formatTokens } from "@/lib/utils";
import { breadcrumbJsonLd, JsonLd, techArticleJsonLd } from "@/lib/seo/jsonld";
import { site } from "@/lib/site";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllModels().map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const model = getModel(slug);
  if (!model) return {};
  const cheapest = [...model.pricing].sort((a, b) => a.inputPer1M - b.inputPer1M)[0];
  const title = `${model.name} API Pricing: ${formatPricePer1M(cheapest.inputPer1M)}/1M input, ${formatPricePer1M(cheapest.outputPer1M)}/1M output`;
  return {
    title,
    description: `${model.name} API prices across ${model.pricing.length} provider(s). Context ${formatTokens(model.context.tokens)} tokens. Verified ${formatDate(model.lastVerifiedAt)} — sources linked.`,
    alternates: { canonical: `/models/${model.slug}` },
  };
}

export default async function ModelPage({ params }: Props) {
  const { slug } = await params;
  const model = getModel(slug);
  if (!model) notFound();

  return (
    <div className="mx-auto w-full max-w-content px-4 py-12 sm:px-6">
      <JsonLd
        data={[
          techArticleJsonLd(model),
          breadcrumbJsonLd([
            { name: "Home", url: site.url },
            { name: "Pricing", url: `${site.url}/pricing` },
            { name: model.name, url: `${site.url}/models/${model.slug}` },
          ]),
        ]}
      />

      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{model.status.toUpperCase()}</Badge>
          {model.openWeights ? <Badge>Open weights{model.license ? ` · ${model.license}` : ""}</Badge> : null}
          <span className="text-sm text-muted-foreground">Released {formatDate(model.releasedAt)}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{model.name} API pricing</h1>
        <p className="max-w-2xl text-muted-foreground">
          Prices per 1M tokens for {model.name} across {model.pricing.length} provider
          {model.pricing.length > 1 ? "s" : ""}. Context window {formatTokens(model.context.tokens)} tokens
          {model.context.maxOutput ? `, max output ${formatTokens(model.context.maxOutput)}` : ""}.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {model.capabilities.map((c) => (
          <Badge key={c} variant="outline">
            {c}
          </Badge>
        ))}
      </div>

      <Card className="mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead className="text-right">Input $/1M</TableHead>
              <TableHead className="text-right">Output $/1M</TableHead>
              <TableHead className="text-right">Cached input $/1M</TableHead>
              <TableHead className="hidden sm:table-cell">Updated</TableHead>
              <TableHead className="hidden sm:table-cell">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.pricing.map((p) => {
              const provider = getProvider(p.provider);
              return (
                <TableRow key={p.provider}>
                  <TableCell className="font-medium">{provider?.name ?? p.provider}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPricePer1M(p.inputPer1M)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPricePer1M(p.outputPer1M)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.cachedInputPer1M !== undefined ? formatPricePer1M(p.cachedInputPer1M) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDate(p.updatedAt)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <a href={p.sourceUrl} rel="noopener nofollow" className="text-accent hover:underline">
                      official page ↗
                    </a>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Last verified: <time dateTime={model.lastVerifiedAt}>{formatDate(model.lastVerifiedAt)}</time>. Prices
          change — always confirm on the official page before budgeting.
        </span>
        <Link href="/calculators/cost" className="shrink-0 text-accent hover:underline">
          Estimate monthly cost →
        </Link>
      </div>
    </div>
  );
}
