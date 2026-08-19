import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllModels, getModel } from "@/lib/data/models";
import { ARENA_CATEGORY_ORDER, getBenchmarksMeta, getEmptyBenchmarkNotes } from "@/lib/data/benchmarks";
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
  const arenaMeta = getBenchmarksMeta();
  const emptyBenchmarkNote = getEmptyBenchmarkNotes()[model.slug];
  const arenaEntries = ARENA_CATEGORY_ORDER.flatMap((cat) => {
    const entry = model.arena?.[cat];
    return entry ? [{ cat, entry, meta: arenaMeta.categories[cat] }] : [];
  });

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

      {model.pricing.some((p) => p.note) ? (
        <ul className="-mt-6 mb-8 list-disc space-y-1 pl-5 text-sm leading-6 text-ink2">
          {model.pricing
            .filter((p) => p.note)
            .map((p) => (
              <li key={p.provider}>{p.note}</li>
            ))}
        </ul>
      ) : null}

      {arenaEntries.length > 0 || model.benchmarks?.length ? (
        <section className="mb-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
              Arena &amp; benchmarks
            </h2>
            <Link
              href="/benchmarks"
              className="font-mono text-xs uppercase tracking-[0.08em] hover:underline hover:underline-offset-4"
            >
              Full leaderboard →
            </Link>
          </div>

          {arenaEntries.length > 0 ? (
            <Card className="row-fade mb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Board</TableHead>
                    <TableHead className="text-right">Arena score</TableHead>
                    <TableHead className="text-right">Rank</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Votes</TableHead>
                    <TableHead className="hidden sm:table-cell">Snapshot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arenaEntries.map(({ cat, entry, meta }) => (
                    <TableRow key={cat}>
                      <TableCell>
                        <span className="font-semibold">{meta.label}</span>
                        {entry.preliminary ? (
                          <Badge variant="secondary" className="ml-1 align-middle" title="Preliminary — low vote count">
                            P
                          </Badge>
                        ) : null}
                        <p className="mt-0.5 font-mono text-[11px] text-ink2">{entry.boardName}</p>
                        {entry.note ? <p className="mt-0.5 text-[13px] leading-5 text-ink2">{entry.note}</p> : null}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold nums">
                        {entry.elo}
                        <span className="ml-1 text-xs font-normal text-ink2">±{entry.ci}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-ink2 nums">#{entry.rank}</TableCell>
                      <TableCell className="hidden text-right font-mono text-ink2 nums sm:table-cell">
                        {entry.votes.toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-ink2 nums sm:table-cell">
                        {formatDate(meta.snapshotAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}

          {model.benchmarks?.length ? (
            <Card className="row-fade">              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Benchmark</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="hidden sm:table-cell">Tested</TableHead>
                    <TableHead className="hidden md:table-cell">Note</TableHead>
                    <TableHead className="hidden sm:table-cell">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.benchmarks.map((b) => (
                    <TableRow key={`${b.name}-${b.sourceUrl}`}>
                      <TableCell className="font-semibold">{b.name}</TableCell>
                      <TableCell className="text-right font-mono font-bold nums">
                        {b.score.toFixed(1)}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-ink2 nums sm:table-cell">
                        {formatDate(b.testedAt)}
                      </TableCell>
                      <TableCell className="hidden text-sm text-ink2 md:table-cell">{b.note ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <a
                          href={b.sourceUrl}
                          rel="noopener nofollow"
                          className="font-mono text-xs underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline"
                        >
                          source ↗
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="space-y-2 border border-line p-4">
              <p className="text-sm font-semibold">No verified benchmarks published yet</p>
              {emptyBenchmarkNote ? (
                <p className="text-[13px] leading-5 text-ink2">{emptyBenchmarkNote}</p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <div className="flex flex-col gap-3 border border-line p-4 text-sm text-ink2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Last verified:{" "}
          <time dateTime={model.lastVerifiedAt} className="font-mono nums">
            {formatDate(model.lastVerifiedAt)}
          </time>
          . Prices change — always confirm on the official page before budgeting.
        </span>
        <span className="flex shrink-0 items-center gap-4">
          <Link
            href={`/compare?models=${model.slug}`}
            className="font-mono text-xs uppercase tracking-[0.08em] text-ink hover:underline hover:underline-offset-4"
          >
            Compare →
          </Link>
          <Link
            href="/calculators/cost"
            className="font-mono text-xs uppercase tracking-[0.08em] text-ink hover:underline hover:underline-offset-4"
          >
            Estimate monthly cost →
          </Link>
        </span>
      </div>
    </div>
  );
}
