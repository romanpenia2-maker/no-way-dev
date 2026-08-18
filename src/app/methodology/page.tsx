import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Methodology — how pricing data is collected",
  description:
    "How no-way.dev collects and verifies LLM API pricing: git-tracked JSON, weekly bot checks, official sources only, and how to report an error.",
  alternates: { canonical: "/methodology" },
};

const sections = [
  {
    title: "Data model",
    body: "Every model is a single JSON file in the public repository (data/models/). A file contains the context window, capabilities and a list of pricing entries — one per provider — each with input/output prices per 1M tokens, an optional cached-input price, the date it was last checked and a link to the official source page.",
  },
  {
    title: "Sources",
    body: "Only first-party sources: official provider pricing pages and documentation. Aggregators and blog posts are never used as a price source. If a provider changes a page structure, the entry is flagged for manual review instead of guessing.",
  },
  {
    title: "Update cadence",
    body: "A scheduled GitHub Actions workflow runs the update bot weekly. The bot re-reads source pages, diffs them against the current JSON and opens a pull request with the changes. A human reviews and merges — nothing auto-publishes. Each entry shows its own updatedAt date, so staleness is visible per row, not per site.",
  },
  {
    title: "Units and normalization",
    body: "All prices are stored in USD per 1 million tokens. Tiered pricing (e.g. different rates above a context threshold) is stored at the base tier and noted on the model page. Batch/offline discounts are out of scope for now.",
  },
  {
    title: "Report an error",
    body: `Spotted a wrong or stale number? Open an issue in the GitHub repository (${site.github}) with the model, the wrong value and a link to the official page. Corrections are typically reviewed within a day. You can also open a pull request directly — the data files are plain JSON validated by zod schemas.`,
  },
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Process</p>
      <h1 className="mb-3 font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-5xl">
        Methodology
      </h1>
      <p className="mb-10 text-[15px] leading-7 text-ink2">
        Trust comes from process. Here is exactly how the numbers on this site are collected and kept fresh.
      </p>
      <div className="space-y-10">
        {sections.map((s, i) => (
          <section key={s.title} className="border-t border-ink pt-4">
            <p className="mb-1 font-mono text-xs font-bold text-ink2 nums">{String(i + 1).padStart(2, "0")}</p>
            <h2 className="mb-2 font-display text-xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
              {s.title}
            </h2>
            <p className="text-[15px] leading-7 text-ink2">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
