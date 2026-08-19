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
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Colophon</p>
      <h1 className="mb-6 font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-5xl">
        About
      </h1>
      <div className="space-y-4 text-[15px] leading-7 text-ink2">
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
          <a href={site.github} rel="noopener" className="font-medium text-ink underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline">
            Open an issue on GitHub
          </a>{" "}
          — corrections usually ship within a day.
        </p>
      </div>
    </div>
  );
}
