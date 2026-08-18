import type { Metadata } from "next";
import { JsonLd, personJsonLd } from "@/lib/seo/jsonld";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "Who runs no-way.dev and why the site exists.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <JsonLd data={personJsonLd()} />
      <h1 className="mb-6 text-3xl font-bold tracking-tight">About</h1>
      <div className="space-y-4 text-muted-foreground">
        <p>
          no-way.dev is built and maintained by an ex-developer, AI R&amp;D team lead. After years of wiring LLM
          APIs into products — and re-checking pricing pages far too often — I started keeping a single reference
          with sources and dates. This site is that reference, made public.
        </p>
        <p>
          Everything here is data-first: prices live in a public git repository, each number links to the official
          provider page, and updates are proposed by automated bots and merged after review. No affiliate links, no
          sponsored rankings.
        </p>
        <p>
          Found an error or a stale price?{" "}
          <a href={site.github} rel="noopener" className="text-accent hover:underline">
            Open an issue on GitHub
          </a>{" "}
          — corrections usually ship within a day.
        </p>
      </div>
    </div>
  );
}
