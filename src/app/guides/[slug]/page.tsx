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
      <header className="mb-10 space-y-3 border-b border-line pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Guide</p>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em]">
          {guide.frontmatter.title}
        </h1>
        <p className="text-[15px] leading-7 text-ink2">{guide.frontmatter.description}</p>
        <p className="font-mono text-[11px] text-ink2 nums">
          Published <time dateTime={guide.frontmatter.publishedAt}>{formatDate(guide.frontmatter.publishedAt)}</time>
        </p>
      </header>
      <article className="mdx-content">
        <MDXRemote
          source={guide.content}
          options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          components={{
            // Wide GFM tables scroll horizontally instead of breaking the layout.
            table: (props: React.ComponentProps<"table">) => (
              <div className="overflow-x-auto">
                <table {...props} />
              </div>
            ),
          }}
        />
      </article>
    </div>
  );
}
