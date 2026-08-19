import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllGuides } from "@/lib/guides";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Guides — practical LLM API know-how",
  description: "Practical guides on LLM API pricing, cost optimization and model selection.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  const guides = getAllGuides();

  return (
    <div className="w-full px-4 py-12 sm:px-6 lg:px-12">
      <div className="mb-8 max-w-2xl space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Reference / 03</p>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-5xl">
          Guides
        </h1>
        <p className="text-[15px] leading-7 text-ink2">
          Short, practical write-ups. Numbers come from the same dataset as the pricing pages.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {guides.map((g, i) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="group">
            <Card className="h-full group-hover:bg-ink group-hover:text-paper [&_*]:group-hover:text-paper">
              <CardHeader>
                <p className="border-t border-ink pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2 group-hover:border-paper">
                  Guide · {String(i + 1).padStart(2, "0")}
                </p>
                <CardTitle>{g.frontmatter.title}</CardTitle>
                <CardDescription>{g.frontmatter.description}</CardDescription>
                <p className="pt-1 font-mono text-[11px] text-ink2 nums">{formatDate(g.frontmatter.publishedAt)}</p>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
