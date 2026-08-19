import type { MetadataRoute } from "next";
import { getAllModels } from "@/lib/data/models";
import { getAllGuides } from "@/lib/guides";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/pricing", "/benchmarks", "/calculators/cost", "/guides", "/about", "/methodology"].map((p) => ({
    url: `${site.url}${p}`,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.8,
  }));

  const models = getAllModels().map((m) => ({
    url: `${site.url}/models/${m.slug}`,
    lastModified: m.lastVerifiedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const guides = getAllGuides().map((g) => ({
    url: `${site.url}/guides/${g.slug}`,
    lastModified: g.frontmatter.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...models, ...guides];
}
