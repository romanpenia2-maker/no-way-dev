"use client";

/**
 * Fixtures for /dev/detector-map — plausible DetectionResponse / C2PA / error
 * objects rendered by the REAL detector components (DetectionResultView,
 * C2paVerdict, gate counter, error cards, image input). No network, no WASM:
 * c2pa-web is only loaded by checkC2pa(), which previews never call.
 */

import { useMemo, useRef } from "react";
import {
  C2paVerdict,
  DetectionResultView,
  ErrorCard,
  FileErrorAlert,
  FirstVisitHints,
  GateCounter,
  GateReason,
  ImageInput,
  type Gate,
  type ImagePreviewState,
  RateLimitCard,
} from "@/components/ai-detector";
import { Button } from "@/components/ui/button";
import type { DetectorCopy, DetectorThresholds } from "@data/schemas/detector.schema";
import type { C2paOutcome } from "@/lib/detector/c2pa-client";
import type { DetectionKind, DetectionResponse, LayerReport } from "@/lib/detector/types";

export interface FixtureProps {
  copy: DetectorCopy;
  thresholds: DetectorThresholds;
}

// --- placeholder image (inline SVG data-uri, monochrome) ----------------------

const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">` +
      `<rect width="1024" height="1024" fill="#e8e6e1"/>` +
      `<rect x="232" y="232" width="560" height="560" fill="none" stroke="#1b1b16" stroke-width="10"/>` +
      `<circle cx="512" cy="432" r="88" fill="#1b1b16"/>` +
      `<path d="M232 792 L472 512 L632 672 L712 592 L792 672 L792 792 Z" fill="#1b1b16"/>` +
      `</svg>`,
  );

export const fixturePreview: ImagePreviewState = {
  url: PLACEHOLDER_IMG,
  name: "portrait-studio-042.png",
  bytes: 8_388_608 - 1_200_000, // 6.9 MB
};

// --- text fixture with consistent span offsets ---------------------------------

const SENTENCES = [
  "The committee announced on Tuesday that the revised framework will take effect in March.",
  "Officials described the decision as a significant step toward greater transparency.",
  "Critics, however, argue that the new rules leave too much room for interpretation.",
  "Maria Hobart, who led the consultation, said the draft reflected months of negotiation.",
  "I genuinely think she is right, and honestly the whole process felt refreshingly open.",
  "The measure will be reviewed again after the first full year of implementation.",
];

const SPAN_SCORES = [0.93, 0.89, 0.34, 0.86, 0.12, 0.91];

export const fixtureText = SENTENCES.join(" ");

export const fixtureSpans = SENTENCES.reduce<{ start: number; end: number; score: number }[]>(
  (acc, sentence, i) => {
    const start = i === 0 ? 0 : acc[i - 1].end + 1;
    acc.push({ start, end: start + sentence.length, score: SPAN_SCORES[i] });
    return acc;
  },
  [],
);

// --- DetectionResponse builder ---------------------------------------------------

const ok: LayerReport = { state: "ok" };

function makeResult(partial: Partial<DetectionResponse> & Pick<DetectionResponse, "status">): DetectionResponse {
  return {
    probability: 0.5,
    ci: [0.4, 0.6],
    attribution: [
      { family: "openai-gpt", label: "GPT-style", probability: 0.62 },
      { family: "meta-llama", label: "Llama-style", probability: 0.24 },
      { family: "anthropic-claude", label: "Claude-style", probability: 0.14 },
    ],
    spans: fixtureSpans,
    layers: { provenance: ok, zeroshot: ok, attribution: ok, external: ok },
    notes: ["Bootstrap CI over 100 resamples of the zero-shot score."],
    disclaimer:
      "This verdict is a probabilistic signal, not proof. Detectors produce false positives and false negatives; edited or paraphrased AI text can score as human, and formal human writing can score as AI. Never use this result as the sole basis for academic, legal or employment decisions.",
    input: { kind: "text", words: 212 },
    ...partial,
  };
}

export const results = {
  confAi: makeResult({ status: "confident_ai", probability: 0.91, ci: [0.86, 0.95] }),
  likelyAi: makeResult({ status: "likely_ai", probability: 0.68, ci: [0.52, 0.81] }),
  abstain: makeResult({
    status: "insufficient_data",
    probability: 0.42,
    ci: [0.28, 0.57],
    notes: ["Score inside the abstention band — the detector refuses to pick a side."],
  }),
  likelyHuman: makeResult({ status: "likely_human", probability: 0.33, ci: [0.19, 0.5] }),
  confHuman: makeResult({ status: "confident_human", probability: 0.08, ci: [0.04, 0.15] }),
  borderlineExt: makeResult({
    status: "likely_ai",
    probability: 0.71,
    ci: [0.41, 0.9],
    layers: { provenance: ok, zeroshot: ok, attribution: ok, external: { state: "ok", detail: "Sapling p=0.87" } },
    notes: [
      "Borderline score — an independent external detector (Sapling) was included in the verdict.",
      "Bootstrap CI over 100 resamples of the zero-shot score.",
    ],
  }),
  noMl: makeResult({
    status: "insufficient_data",
    probability: null,
    ci: null,
    attribution: null,
    spans: [],
    layers: {
      provenance: ok,
      zeroshot: { state: "unavailable", detail: "No LLM provider key configured on this deployment." },
      attribution: { state: "unavailable", detail: "Depends on the zero-shot layer." },
      external: { state: "unavailable", detail: "No external detector key configured." },
    },
    notes: [],
  }),
  extOnly: makeResult({
    status: "likely_ai",
    probability: 0.74,
    ci: null,
    attribution: null,
    spans: [],
    layers: {
      provenance: ok,
      zeroshot: { state: "error", detail: "Provider timeout after 20 s." },
      attribution: { state: "unavailable", detail: "Depends on the zero-shot layer." },
      external: { state: "ok", detail: "Sapling p=0.74" },
    },
    notes: ["Zero-shot layer failed; verdict is based on the external detector only."],
  }),
  imgNoSignals: makeResult({
    status: "insufficient_data",
    probability: null,
    ci: null,
    attribution: null,
    spans: [],
    layers: {
      provenance: { state: "ok", detail: "No provenance signals found in metadata." },
      zeroshot: { state: "skipped", detail: "Not applicable to images." },
      attribution: { state: "skipped", detail: "Not applicable to images." },
      external: { state: "unavailable", detail: "Sightengine is not configured on this deployment." },
    },
    notes: [],
    input: { kind: "image", bytes: fixturePreview.bytes },
  }),
};

export const c2paOutcomes = {
  signedAi: {
    kind: "signed_ai",
    generator: "Adobe Firefly 2.0",
    validationState: "Valid",
  },
  signedOther: {
    kind: "signed_other",
    generator: "Canon EOS R5 firmware 1.8",
    validationState: "Valid",
  },
  invalid: {
    kind: "invalid",
    detail:
      "A C2PA manifest is present but its signature is INVALID — the file or metadata was modified after signing.",
  },
} satisfies Record<string, C2paOutcome>;

// --- shared form shell (gates / empty states) --------------------------------------

function FormShell({
  copy,
  thresholds,
  kind,
  value,
  gate,
  words,
  lines,
  chars,
  visited,
  extra,
}: FixtureProps & {
  kind: DetectionKind;
  value: string;
  gate: Gate;
  words: number;
  lines: number;
  /** Overrides value.length for the counter (long-code fixture without a 50 KB string). */
  chars?: number;
  visited: boolean | null;
  extra?: React.ReactNode;
}) {
  const canSubmit = gate === "ok";
  return (
    <div className="space-y-4">
      <textarea
        readOnly
        value={value}
        rows={kind === "code" ? 8 : 6}
        placeholder={
          kind === "code"
            ? `Paste at least ${thresholds.code.minLines} lines of code (max ${thresholds.code.maxChars.toLocaleString("en-US")} chars)…`
            : `Paste at least ${thresholds.text.minWords} words of text (max ${thresholds.text.maxWords.toLocaleString("en-US")} words)…`
        }
        className={`w-full resize-y border border-ink bg-paper p-4 text-sm leading-6 text-ink placeholder:text-ink2 ${
          kind === "code" ? "font-mono text-[13px]" : ""
        }`}
        aria-label={kind === "code" ? "Code to check" : "Text to check"}
      />
      <FirstVisitHints copy={copy} kind={kind} visited={visited} />
      <GateCounter
        kind={kind}
        gate={gate}
        words={words}
        lines={lines}
        chars={chars ?? value.length}
        copy={copy}
        thresholds={thresholds}
      />
      {extra}
      <div className="flex flex-wrap items-center gap-4">
        <Button size="lg" disabled={!canSubmit} className="min-h-11" aria-disabled={!canSubmit}>
          Run detection
        </Button>
        {gate === "short" ? (
          <GateReason copy={copy} />
        ) : (
          <span className="font-mono text-[11px] text-ink2">
            Text is sent to the server API for scoring. Rate limit: 30 checks/hour.
          </span>
        )}
      </div>
    </div>
  );
}

/** Dropzone preview (real ImageInput) with a synthetic File — no C2PA/WASM is loaded. */
function ImageInputFixture({
  copy,
  withFile,
  checking,
}: FixtureProps & { withFile: boolean; checking: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const file = useMemo(
    () => (withFile ? new File([new Uint8Array(2048)], fixturePreview.name, { type: "image/png" }) : null),
    [withFile],
  );
  return (
    <ImageInput
      file={file}
      dragOver={false}
      setDragOver={() => {}}
      onFile={() => {}}
      fileInputRef={fileInputRef}
      c2pa={null}
      checking={checking}
      c2paSlow={false}
      onSkipC2pa={() => {}}
      copy={copy}
    />
  );
}

// --- per-state preview components (keyed by state id) --------------------------------

const SHORT_TEXT =
  "The report lands at a strange moment for the industry. Demand keeps rising, budgets keep shrinking, " +
  "and every team I spoke to described the same tension between speed and care.";

const SHORT_CODE = `export function area(w: number, h: number): number {
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

export function perimeter(w: number, h: number): number {
  return 2 * (w + h);
}`;

export const statePreviews: Record<string, React.ComponentType<FixtureProps>> = {
  "S-EMPTY-FIRST": (p) => (
    <FormShell {...p} kind="text" value="" gate="empty" words={0} lines={0} visited={false} />
  ),
  "S-EMPTY-RETURN": (p) => (
    <FormShell {...p} kind="text" value="" gate="empty" words={0} lines={0} visited={true} />
  ),
  "S-GATE-SHORT-TEXT": (p) => (
    <FormShell {...p} kind="text" value={SHORT_TEXT} gate="short" words={32} lines={1} visited={true} />
  ),
  "S-GATE-LONG-TEXT": (p) => (
    <FormShell
      {...p}
      kind="text"
      value={fixtureText}
      gate="long"
      words={24_300}
      lines={1}
      visited={true}
    />
  ),
  "S-GATE-SHORT-CODE": (p) => (
    <FormShell {...p} kind="code" value={SHORT_CODE} gate="short" words={0} lines={7} visited={true} />
  ),
  "S-GATE-LONG-CODE": (p) => (
    <FormShell
      {...p}
      kind="code"
      value={SHORT_CODE}
      gate="long"
      words={0}
      lines={7}
      chars={61_200}
      visited={true}
    />
  ),
  "S-RES-CONF-AI": (p) => (
    <DetectionResultView result={results.confAi} copy={p.copy} kind="text" text={fixtureText} />
  ),
  "S-RES-LIKELY-AI": (p) => (
    <DetectionResultView result={results.likelyAi} copy={p.copy} kind="text" text={fixtureText} />
  ),
  "S-RES-ABSTAIN": (p) => (
    <DetectionResultView result={results.abstain} copy={p.copy} kind="text" text={fixtureText} />
  ),
  "S-RES-LIKELY-HUMAN": (p) => (
    <DetectionResultView result={results.likelyHuman} copy={p.copy} kind="text" text={fixtureText} />
  ),
  "S-RES-CONF-HUMAN": (p) => (
    <DetectionResultView result={results.confHuman} copy={p.copy} kind="text" text={fixtureText} />
  ),
  "S-RES-BORDERLINE-EXT": (p) => (
    <DetectionResultView result={results.borderlineExt} copy={p.copy} kind="text" text={fixtureText} />
  ),
  "S-NO-ML": (p) => <DetectionResultView result={results.noMl} copy={p.copy} kind="text" text={fixtureText} />,
  "S-EXT-ONLY": (p) => (
    <DetectionResultView result={results.extOnly} copy={p.copy} kind="text" text={fixtureText} />
  ),
  "S-RATE-LIMIT": (p) => (
    <div className="space-y-4">
      <FormShellReadonlyText />
      <RateLimitCard
        error={{ kind: "rate-limit", detail: "Too many checks. Try again later.", retryAfterSeconds: 47 * 60 }}
        copy={p.copy}
        isImage={false}
        onRetry={() => {}}
      />
    </div>
  ),
  "S-NETWORK-ERR": (p) => (
    <div className="space-y-4">
      <FormShellReadonlyText />
      <ErrorCard error={{ kind: "network", detail: "TypeError: Failed to fetch" }} copy={p.copy} onRetry={() => {}} />
    </div>
  ),
  "S-IMG-TOO-BIG": (p) => (
    <div className="space-y-2">
      <ImageInputFixture {...p} withFile={false} checking={false} />
      <FileErrorAlert message={p.copy.c2pa.tooBig.replace("{size}", "9.4 MB")} />
    </div>
  ),
  "S-IMG-BAD-FORMAT": (p) => (
    <div className="space-y-2">
      <ImageInputFixture {...p} withFile={false} checking={false} />
      <FileErrorAlert message={p.copy.c2pa.badFormat} />
    </div>
  ),
  "S-IMG-C2PA-LOADING": (p) => (
    <div className="space-y-4">
      <ImageInputFixture {...p} withFile checking />
      <Button size="lg" disabled className="min-h-11" aria-disabled="true">
        Reading signature…
      </Button>
    </div>
  ),
  "S-IMG-C2PA-AI": (p) => (
    <C2paVerdict outcome={c2paOutcomes.signedAi} copy={p.copy} preview={fixturePreview} />
  ),
  "S-IMG-C2PA-NOAI": (p) => (
    <C2paVerdict outcome={c2paOutcomes.signedOther} copy={p.copy} preview={fixturePreview} />
  ),
  "S-IMG-C2PA-INVALID": (p) => (
    <C2paVerdict
      outcome={c2paOutcomes.invalid}
      copy={p.copy}
      preview={fixturePreview}
      onCheckAnyway={() => {}}
    />
  ),
  "S-IMG-NO-SIGNALS": (p) => (
    <DetectionResultView
      result={results.imgNoSignals}
      copy={p.copy}
      kind="image"
      text={null}
      preview={fixturePreview}
    />
  ),
  "S-RES-STALE-GUARD": (p) => (
    <div className="space-y-4">
      <p className="font-mono text-[11px] leading-5 text-ink2">
        The verdict card was removed from the DOM as soon as the input changed — the CTA is active
        again for the edited text.
      </p>
      <FormShell
        {...p}
        kind="text"
        value={`${fixtureText} (edited paragraph added by the user after the verdict)`}
        gate="ok"
        words={224}
        lines={1}
        visited={true}
      />
    </div>
  ),
};

/** Filled textarea shown above error cards (the input survives the error). */
function FormShellReadonlyText() {
  return (
    <textarea
      readOnly
      value={fixtureText}
      rows={4}
      className="w-full resize-y border border-ink bg-paper p-4 text-sm leading-6 text-ink"
      aria-label="Text to check"
    />
  );
}
