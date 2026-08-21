import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetectorMap, STATE_COUNT } from "@/components/dev/detector-map";
import { getDetectorCopy, getDetectorThresholds } from "@/lib/detector/config";

export const metadata: Metadata = {
  title: "/ai-detector — live state map (dev)",
  robots: { index: false, follow: false },
};

// The prod guard must run per request, not at prerender time.
export const dynamic = "force-dynamic";

const SPEC_URL = "https://github.com/romanpenia2-maker/no-way-dev/blob/rc/docs/ux-maps/detector.md";

export default function DetectorMapPage() {
  // Dev-only tool: never exposed on production deployments.
  if (process.env.VERCEL_ENV === "production") notFound();

  const copy = getDetectorCopy();
  const thresholds = getDetectorThresholds();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Dev / internal</p>
      <h1 className="mb-3 font-display text-3xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-4xl">
        /ai-detector — live state map
      </h1>
      <p className="mb-2 text-[15px] leading-7 text-ink2">
        Dev-only map of every terminal UI state, rendered live by the real detector components on
        fixtures — not screenshots.
      </p>
      <p className="mb-10 font-mono text-[11px] leading-5 text-ink2">
        {STATE_COUNT} states · spec:{" "}
        <a
          href={SPEC_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:bg-ink hover:text-paper"
        >
          docs/ux-maps/detector.md
        </a>{" "}
        · expand a leaf for its fixture-rendered preview
      </p>

      <DetectorMap copy={copy} thresholds={thresholds} />
    </div>
  );
}
