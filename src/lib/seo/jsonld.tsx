import type { Model } from "@data/schemas/model.schema";
import { site } from "@/lib/site";

type JsonLdData = Record<string, unknown>;

/** Renders a <script type="application/ld+json"> tag. Use inside a server component. */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    description: site.description,
  };
}

export function techArticleJsonLd(model: Model) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `${model.name} API Pricing`,
    description: `API prices for ${model.name}: input/output cost per 1M tokens across providers, context window of ${model.context.tokens.toLocaleString("en-US")} tokens, capabilities and data freshness.`,
    dateModified: model.lastVerifiedAt,
    author: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
    },
    about: {
      "@type": "SoftwareApplication",
      name: model.name,
      applicationCategory: "Large Language Model API",
    },
  };
}

export function personJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "no-way.dev author",
    jobTitle: "Ex-developer, AI R&D Team Lead",
    url: `${site.url}/about`,
    worksFor: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
