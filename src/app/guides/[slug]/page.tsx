import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { getAllGuides, getGuide } from "@/lib/guides";
import { formatDate } from "@/lib/utils";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { site } from "@/lib/site";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: guide.frontmatter.title,
    description: guide.frontmatter.description,
    alternates: { canonical: `/guides/${guide.slug}` },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: site.url },
          { name: "Guides", url: `${site.url}/guides` },
          { name: guide.frontmatter.title, url: `${site.url}/guides/${guide.slug}` },
        ])}
      />
      <header className="mb-10 space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{guide.frontmatter.title}</h1>
        <p className="text-muted-foreground">{guide.frontmatter.description}</p>
        <p className="text-sm text-muted-foreground">
          Published <time dateTime={guide.frontmatter.publishedAt}>{formatDate(guide.frontmatter.publishedAt)}</time>
        </p>
      </header>
      <article className="mdx-content">
        <MDXRemote
          source={guide.content}
          options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
        />
      </article>
    </div>
  );
}
