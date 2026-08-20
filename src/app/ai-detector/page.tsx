import type { Metadata } from "next";
import { AiDetector } from "@/components/ai-detector";
import { getDetectorCopy, getDetectorThresholds } from "@/lib/detector/config";
import { DETECTION_KINDS, type DetectionKind } from "@/lib/detector/types";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { first } from "@/lib/search-params";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Content Detector — text, code & images with honest confidence",
  description:
    "Free AI content detector for text, code and images. C2PA provenance checks in your browser, Binoculars-style perplexity scoring, model-family attribution and calibrated verdicts with confidence intervals — no fake precision.",
  alternates: { canonical: "/ai-detector" },
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AiDetectorPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rawKind = first(sp.kind);
  const initialKind: DetectionKind = DETECTION_KINDS.includes(rawKind as DetectionKind)
    ? (rawKind as DetectionKind)
    : "text";

  const copy = getDetectorCopy();
  const thresholds = getDetectorThresholds();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "no-way.dev AI Content Detector",
            url: `${site.url}/ai-detector`,
            applicationCategory: "UtilitiesApplication",
            operatingSystem: "Any (browser)",
            browserRequirements: "Requires JavaScript",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            description:
              "Detect AI-generated text, code and images with calibrated probabilities, confidence intervals, C2PA provenance verification and model-family attribution.",
            creator: { "@type": "Organization", name: site.name, url: site.url },
          },
          breadcrumbJsonLd([
            { name: "Home", url: site.url },
            { name: "AI Detector", url: `${site.url}/ai-detector` },
          ]),
        ]}
      />

      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Tool / 01</p>
      <h1 className="mb-3 font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-5xl">
        AI content detector
      </h1>
      <p className="mb-10 text-[15px] leading-7 text-ink2">
        Check text, code or an image for AI origin. You get a calibrated verdict with a confidence
        interval — and an honest «insufficient data» when the input is too short or the signal is
        ambiguous. Read the{" "}
        <a href="/methodology" className="underline underline-offset-4 hover:bg-ink hover:text-paper">
          methodology
        </a>{" "}
        for how we treat numbers on this site.
      </p>

      <AiDetector initialKind={initialKind} copy={copy} thresholds={thresholds} />
    </div>
  );
}
