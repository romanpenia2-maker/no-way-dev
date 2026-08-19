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

  const cheapest = [...model.pricing].sort((a, b) => a.inputPer1M - b.inputPer1M)[0];

  return (
    <div className="w-full px-4 py-12 sm:px-6 lg:px-12">
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

      <div className="mb-8 border-b border-line pb-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{model.status}</Badge>
          <Badge variant={model.openWeights ? "outline" : "solid"}>
            {model.openWeights ? `Open${model.license ? ` · ${model.license}` : ""}` : "Closed"}
          </Badge>
          <span className="font-mono text-[11px] text-ink2 nums">released {formatDate(model.releasedAt)}</span>
        </div>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-6xl">
          {model.name}
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-ink2">
          API pricing · verified {formatDate(model.lastVerifiedAt)}
        </p>

        {/* Числа — герои блока */}
        <div className="mt-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          <div className="bg-paper p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Input from $/1M</p>
            <p className="mt-2 font-mono text-2xl font-bold leading-none nums sm:text-3xl">
              {formatPricePer1M(cheapest.inputPer1M)}
            </p>
          </div>
          <div className="bg-paper p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Output from $/1M</p>
            <p className="mt-2 font-mono text-2xl font-bold leading-none nums sm:text-3xl">
              {formatPricePer1M(cheapest.outputPer1M)}
            </p>
          </div>
          <div className="bg-paper p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Context</p>
            <p className="mt-2 font-mono text-2xl font-bold leading-none nums sm:text-3xl">
              {formatTokens(model.context.tokens)}
            </p>
          </div>
          <div className="bg-paper p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Providers</p>
            <p className="mt-2 font-mono text-2xl font-bold leading-none nums sm:text-3xl">
              {String(model.pricing.length).padStart(2, "0")}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {model.capabilities.map((c) => (
          <Badge key={c} variant="secondary">
            {c}
          </Badge>
        ))}
      </div>

      <Card className="row-fade mb-8">
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
                  <TableCell className="font-semibold">{provider?.name ?? p.provider}</TableCell>
                  <TableCell className="text-right font-mono font-bold nums">
                    {formatPricePer1M(p.inputPer1M)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold nums">
                    {formatPricePer1M(p.outputPer1M)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-ink2 nums">
                    {p.cachedInputPer1M !== undefined ? formatPricePer1M(p.cachedInputPer1M) : "—"}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-ink2 nums sm:table-cell">
                    {formatDate(p.updatedAt)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <a
                      href={p.sourceUrl}
                      rel="noopener nofollow"
                      className="font-mono text-xs underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
                    >
                      official page ↗
                    </a>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="flex flex-col gap-3 border border-line p-4 text-sm text-ink2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Last verified:{" "}
          <time dateTime={model.lastVerifiedAt} className="font-mono nums">
            {formatDate(model.lastVerifiedAt)}
          </time>
          . Prices change — always confirm on the official page before budgeting.
        </span>
        <Link
          href="/calculators/cost"
          className="shrink-0 font-mono text-xs uppercase tracking-[0.08em] text-ink hover:underline hover:underline-offset-4"
        >
          Estimate monthly cost →
        </Link>
      </div>
    </div>
  );
}
