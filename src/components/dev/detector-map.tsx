"use client";

/**
 * /dev/detector-map — live state map for /ai-detector.
 * Renders the if-else tree from docs/ux-maps/detector.md; every terminal state
 * (S-*) carries a scaled-down preview rendered by the real detector components
 * on fixtures from src/dev/detector-fixtures.tsx. Dev-only (page 404s on prod).
 */

import { useEffect, useRef, useState } from "react";
import { statePreviews, type FixtureProps } from "@/dev/detector-fixtures";

interface StateDef {
  id: string;
  /** One-line description (EN). */
  blurb: string;
  /** What the user is expected to do next. */
  action: string;
}

interface Branch {
  label: string;
  note?: string;
  states?: StateDef[];
  children?: Branch[];
}

const kebab = (id: string) => id.toLowerCase();

const TREE: Branch[] = [
  {
    label: "A. Empty state (nothing entered)",
    states: [
      {
        id: "S-EMPTY-FIRST",
        blurb: "First visit, Text tab: H1, tabs, empty field, 3-step orientation, disabled CTA.",
        action: "Paste content or open an example.",
      },
      {
        id: "S-EMPTY-RETURN",
        blurb: "Returning visitor: same layout, orientation collapsed to a single link.",
        action: "Paste content right away.",
      },
    ],
  },
  {
    label: "B. Input: text",
    children: [
      {
        label: "B1/B2. Length gates",
        states: [
          {
            id: "S-GATE-SHORT-TEXT",
            blurb: "1–149 words: counter explains the minimum, submit disabled (no request sent).",
            action: "Add more text or leave.",
          },
          {
            id: "S-GATE-LONG-TEXT",
            blurb: "> 20,000 words: bold counter states the limit, submit disabled.",
            action: "Trim the input to the most representative chapters.",
          },
        ],
      },
      {
        label: "B3. Valid text → system: all layers ok",
        states: [
          {
            id: "S-RES-CONF-AI",
            blurb: "p ≥ 0.80: solid badge, tight CI, highlighted evidence segments.",
            action: "Accept as a strong signal; check the highlighted segments.",
          },
          {
            id: "S-RES-LIKELY-AI",
            blurb: "0.55 ≤ p < 0.80: outline badge, wide CI — a hint, not a verdict.",
            action: "Treat as 'leans AI'; look for corroboration.",
          },
          {
            id: "S-RES-ABSTAIN",
            blurb: "0.20 < p < 0.55: 'Insufficient data' + how to get out of the grey zone.",
            action: "Send a longer sample or a before/after-editing pair.",
          },
          {
            id: "S-RES-LIKELY-HUMAN",
            blurb: "0.20 ≥ p > 0.45 zone (1−τ): outline badge, low score, wide CI.",
            action: "Read as 'leans human'; ask for drafts if authorship matters.",
          },
          {
            id: "S-RES-CONF-HUMAN",
            blurb: "p ≤ 0.20: solid badge, strong human signal.",
            action: "Accept the signal — still not proof of authorship.",
          },
        ],
      },
      {
        label: "B3. System fallbacks & failures",
        states: [
          {
            id: "S-RES-BORDERLINE-EXT",
            blurb: "Borderline p + Sapling configured: merged verdict, honestly widened CI.",
            action: "Note the wider CI — two signals ≠ higher precision.",
          },
          {
            id: "S-NO-ML",
            blurb: "No LLM key, no Sapling: 'Detection unavailable' in primary — no verdict possible.",
            action: "Nothing to retry; use the Image tab for local C2PA checks.",
          },
          {
            id: "S-EXT-ONLY",
            blurb: "Zero-shot down, Sapling ok: verdict on a single external signal, said out loud.",
            action: "Treat with extra caution.",
          },
          {
            id: "S-RATE-LIMIT",
            blurb: "HTTP 429: card with Retry-After timer, input stays in the form.",
            action: "Come back when the timer runs out.",
          },
          {
            id: "S-NETWORK-ERR",
            blurb: "Network/5xx/bad JSON: readable card + Retry, raw detail hidden.",
            action: "Press Retry — the input is preserved.",
          },
        ],
      },
    ],
  },
  {
    label: "C. Input: code",
    note: "Same result branches as B3, but external is always skipped → borderline code verdicts abstain more often.",
    states: [
      {
        id: "S-GATE-SHORT-CODE",
        blurb: "1–39 non-empty lines: counter states the 40-line minimum, submit disabled.",
        action: "Paste a whole file, not a snippet.",
      },
      {
        id: "S-GATE-LONG-CODE",
        blurb: "> 50,000 chars: counter states the limit, submit disabled.",
        action: "Paste a single file, not the whole repo.",
      },
    ],
  },
  {
    label: "D. Input: image",
    children: [
      {
        label: "D2/D3. File gates",
        states: [
          {
            id: "S-IMG-TOO-BIG",
            blurb: "File > 8 MB: alert at the dropzone, no preview is created, file reset.",
            action: "Compress or re-export under 8 MB.",
          },
          {
            id: "S-IMG-BAD-FORMAT",
            blurb: "Unsupported/corrupt file: honest refusal, PNG/JPEG only.",
            action: "Convert to PNG or JPEG.",
          },
        ],
      },
      {
        label: "D4. Local C2PA read (browser, WASM on demand)",
        states: [
          {
            id: "S-IMG-C2PA-LOADING",
            blurb: "Reading the signature locally; the file is not uploaded. Skip offered after 8 s.",
            action: "Wait (up to ~10 s on 3G) or skip.",
          },
          {
            id: "S-IMG-C2PA-AI",
            blurb: "Valid signature + AI claim: local verdict, API is never called.",
            action: "Trust the verdict; nothing else to send.",
          },
          {
            id: "S-IMG-C2PA-NOAI",
            blurb: "Valid signature, no AI claim (e.g. camera-signed): provenance verified locally.",
            action: "Accept what the signer declared — not proof of human origin.",
          },
          {
            id: "S-IMG-C2PA-INVALID",
            blurb: "Manifest present but signature invalid: claims untrusted, 'Check anyway' CTA.",
            action: "Accept tampering fact, or run the statistical check.",
          },
        ],
      },
      {
        label: "D5. Server check (metadata + external detector)",
        states: [
          {
            id: "S-IMG-NO-SIGNALS",
            blurb: "No metadata signals and no external detector: nothing reliable to score.",
            action: "Send the original file with metadata intact.",
          },
        ],
        note: "Strong metadata signal → S-RES-CONF-AI; Sightengine ok → S-RES-* by its p; 429/network → shared error states.",
      },
    ],
  },
  {
    label: "E. After any result",
    states: [
      {
        id: "S-RES-STALE-GUARD",
        blurb: "Editing the input annuls the verdict: the card leaves the DOM, CTA re-arms.",
        action: "Re-run the check on the edited input.",
      },
    ],
  },
];

export const STATE_COUNT = TREE.reduce(
  (sum, b) => sum + countStates(b),
  0,
);

function countStates(b: Branch): number {
  return (b.states?.length ?? 0) + (b.children ?? []).reduce((s, c) => s + countStates(c), 0);
}

// --- copy-link button --------------------------------------------------------------

function CopyLink({ anchor }: { anchor: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = `${window.location.origin}${window.location.pathname}#${anchor}`;
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex min-h-6 items-center border border-line px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink2 hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink"
    >
      {copied ? "copied" : "copy link"}
    </button>
  );
}

// --- scaled preview frame -----------------------------------------------------------

const PREVIEW_SCALE = 0.55;
const PREVIEW_MAX_H = 480;

function PreviewFrame({ children }: { children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  // Transforms don't affect layout height, so measure the unscaled content and
  // size the frame to the scaled height (capped — tall cards crop like a screenshot).
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () =>
      setHeight(Math.min(Math.ceil(el.offsetHeight * PREVIEW_SCALE), PREVIEW_MAX_H));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className="mt-3 w-full max-w-[420px] overflow-hidden border border-line bg-paper"
      style={height !== null ? { height } : undefined}
    >
      {/* Inner width is 1/scale of the frame, so scaled content always fits the width. */}
      <div
        ref={innerRef}
        className="pointer-events-none w-[182%] origin-top-left scale-[0.55]"
      >
        {children}
      </div>
    </div>
  );
}

// --- state node (terminal leaf) -------------------------------------------------------

function StateNode({ def, fixtureProps }: { def: StateDef; fixtureProps: FixtureProps }) {
  const anchor = kebab(def.id);
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  // Deep link: open the leaf on load and on same-document hash navigation.
  useEffect(() => {
    const check = () => {
      if (window.location.hash === `#${anchor}` && ref.current && !ref.current.open) {
        ref.current.open = true;
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [anchor]);

  const Preview = statePreviews[def.id];

  return (
    <details
      id={anchor}
      ref={ref}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group/state scroll-mt-24 border border-line bg-paper open:border-ink"
    >
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[10px] text-ink2 transition-transform group-open/state:rotate-90">▶</span>
        <span className="font-mono text-xs font-bold tracking-[0.04em]">{def.id}</span>
        <span className="ml-auto sm:order-last">
          <CopyLink anchor={anchor} />
        </span>
        <span className="min-w-0 basis-full text-[13px] leading-5 text-ink2 sm:order-none sm:basis-0 sm:flex-1">
          {def.blurb}
        </span>
      </summary>
      <div className="border-t border-line px-3 py-3">
        <p className="text-[13px] leading-5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
            owner action:{" "}
          </span>
          {def.action}
        </p>
        {/* Mounted only while open: real components grab focus/run timers on mount,
            so 24 live previews are never alive at once. */}
        {open && Preview ? (
          <PreviewFrame>
            <Preview {...fixtureProps} />
          </PreviewFrame>
        ) : null}
      </div>
    </details>
  );
}

// --- branch (collapsible group, open by default) ---------------------------------------

function BranchNode({ branch, fixtureProps, depth }: { branch: Branch; fixtureProps: FixtureProps; depth: number }) {
  return (
    <details open className="group/branch">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-2 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink [&::-webkit-details-marker]:hidden">
        <span className="transition-transform group-open/branch:rotate-90">▶</span>
        {branch.label}
      </summary>
      <div className="ml-3 space-y-2 border-l border-line py-1 pl-3">
        {branch.note ? <p className="py-1 text-xs leading-5 text-ink2">{branch.note}</p> : null}
        {branch.states?.map((s) => <StateNode key={s.id} def={s} fixtureProps={fixtureProps} />)}
        {branch.children?.map((c) => (
          <BranchNode key={c.label} branch={c} fixtureProps={fixtureProps} depth={depth + 1} />
        ))}
      </div>
    </details>
  );
}

// --- map root ----------------------------------------------------------------------------

export function DetectorMap({ copy, thresholds }: FixtureProps) {
  const fixtureProps = { copy, thresholds };
  return (
    <div className="space-y-2">
      {TREE.map((b) => (
        <BranchNode key={b.label} branch={b} fixtureProps={fixtureProps} depth={0} />
      ))}
    </div>
  );
}
