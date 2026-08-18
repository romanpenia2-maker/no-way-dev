import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const guidesDir = path.join(process.cwd(), "src", "content", "guides");

export interface GuideFrontmatter {
  title: string;
  description: string;
  publishedAt: string;
}

export interface Guide {
  slug: string;
  frontmatter: GuideFrontmatter;
  content: string;
}

export function getGuideSlugs(): string[] {
  return fs
    .readdirSync(guidesDir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""))
    .sort();
}

export function getGuide(slug: string): Guide | undefined {
  const full = path.join(guidesDir, `${slug}.mdx`);
  if (!fs.existsSync(full)) return undefined;
  const { data, content } = matter(fs.readFileSync(full, "utf8"));
  return {
    slug,
    frontmatter: {
      title: String(data.title ?? slug),
      description: String(data.description ?? ""),
      publishedAt: String(data.publishedAt ?? ""),
    },
    content,
  };
}

export function getAllGuides(): Guide[] {
  return getGuideSlugs()
    .map((slug) => getGuide(slug))
    .filter((g): g is Guide => Boolean(g))
    .sort((a, b) => b.frontmatter.publishedAt.localeCompare(a.frontmatter.publishedAt));
}
