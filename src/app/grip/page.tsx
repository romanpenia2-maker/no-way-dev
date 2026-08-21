import type { Metadata } from "next";
import { GripBoard } from "@/components/grip-board";
import { getBundledGripEntries } from "@/lib/data/grip";
import { GRIP_ENTRIES_RAW_URL } from "@/lib/grip";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { site } from "@/lib/site";
import { gripEntriesSchema, type GripEntry } from "@data/schemas/grip.schema";

export const metadata: Metadata = {
  title: "Grip Strength Leaderboard — who squeezes hardest",
  description:
    "Public leaderboard of hand-dynamometer results: name, kilograms and the photo proof. Add your own result — a photo of the dynamometer display can fill in the number automatically.",
  alternates: { canonical: "/grip" },
};

/**
 * Live entries come from raw.githubusercontent.com (revalidated every 60s) so
 * submissions land without a redeploy; the bundled copy is the fallback.
 */
async function getEntries(): Promise<GripEntry[]> {
  try {
    // 5s cap: a slow raw.githubusercontent.com must not stall prerender/ISR —
    // the bundled snapshot is a perfectly good fallback.
    const res = await fetch(GRIP_ENTRIES_RAW_URL, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return gripEntriesSchema.parse(await res.json());
  } catch {
    return getBundledGripEntries();
  }
}

export default async function GripPage() {
  const entries = await getEntries();

  return (
    <div className="w-full px-4 py-12 sm:px-6 lg:px-12">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Grip strength leaderboard",
            url: `${site.url}/grip`,
            numberOfItems: entries.length,
          },
          breadcrumbJsonLd([
            { name: "Home", url: site.url },
            { name: "Grip", url: `${site.url}/grip` },
          ]),
        ]}
      />

      <div className="mb-8 max-w-2xl space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink2">Fun / 01</p>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.94] tracking-[-0.03em] sm:text-5xl">
          Grip strength
        </h1>
        <p className="text-[15px] leading-7 text-ink2">
          Who squeezes hardest. Name, kilograms on the dynamometer, and the photo to prove it — add your own
          result below.
        </p>
      </div>

      <GripBoard initialEntries={entries} />

      <details className="mt-12 max-w-2xl border border-line p-4 text-sm leading-6 text-ink2">
        <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink">
          How to measure grip strength with a dynamometer
        </summary>
        <p className="mt-3">
          Stand upright with your arm hanging at your side, elbow bent about 90°, and hold the dynamometer so the
          display faces away from you. Squeeze as hard as you can for 3–5 seconds without swinging your arm or
          holding your breath — the peak value is your result. Take two attempts per hand and record the best one,
          ideally with the display visible in the photo.
        </p>
      </details>
    </div>
  );
}
