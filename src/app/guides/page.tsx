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
    <div className="mx-auto w-full max-w-content px-4 py-12 sm:px-6">
      <div className="mb-8 max-w-2xl space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Guides</h1>
        <p className="text-muted-foreground">
          Short, practical write-ups. Numbers come from the same dataset as the pricing pages.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {guides.map((g) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="group">
            <Card className="h-full transition-colors group-hover:border-accent/60">
              <CardHeader>
                <CardTitle className="group-hover:text-accent">{g.frontmatter.title}</CardTitle>
                <CardDescription>{g.frontmatter.description}</CardDescription>
                <p className="text-xs text-muted-foreground">{formatDate(g.frontmatter.publishedAt)}</p>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
