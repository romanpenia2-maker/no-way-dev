"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DetectorCopy, DetectorThresholds } from "@data/schemas/detector.schema";
import { checkC2pa, type C2paOutcome } from "@/lib/detector/c2pa-client";
import type {
  DetectionKind,
  DetectionResponse,
  DetectionStatus,
  LayerReport,
} from "@/lib/detector/types";
import { cn } from "@/lib/utils";

interface Props {
  initialKind: DetectionKind;
  copy: DetectorCopy;
  thresholds: DetectorThresholds;
}

const TABS: { kind: DetectionKind; label: string }[] = [
  { kind: "text", label: "Text" },
  { kind: "code", label: "Code" },
  { kind: "image", label: "Image" },
];

const STATUS_VARIANT: Record<DetectionStatus, "solid" | "default" | "secondary"> = {
  confident_ai: "solid",
  likely_ai: "default",
  insufficient_data: "secondary",
  likely_human: "default",
  confident_human: "solid",
  provenance_signed: "solid",
};

type Phase = "idle" | "c2pa" | "posting" | "done" | "error";

/** Structured submit failure — drives the error cards (S-RATE-LIMIT / S-NETWORK-ERR). */
type SubmitError =
  | { kind: "rate-limit"; detail: string; retryAfterSeconds: number }
  | { kind: "network"; detail: string }
  | { kind: "http"; status: number; detail: string };

/** Client-side preview of the uploaded image, shown inside the result card. */
export interface ImagePreviewState {
  /** Object URL created via URL.createObjectURL — owned and revoked by AiDetector. */
  url: string;
  name: string;
  bytes: number;
}

type Gate = "empty" | "short" | "long" | "ok";

const VISITED_KEY = "aidetector.visited";

/** Fill {placeholders} in a copy.json template. */
function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

/** Debounced value — used so aria-live counters announce pauses, not every keystroke. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function AiDetector({ initialKind, copy, thresholds }: Props) {
  const [kind, setKind] = useState<DetectionKind>(initialKind);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResponse | null>(null);
  const [c2pa, setC2pa] = useState<C2paOutcome | null>(null);
  const [preview, setPreview] = useState<ImagePreviewState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /** null = not yet hydrated (render the first-visit variant, matching SSR). */
  const [visited, setVisited] = useState<boolean | null>(null);
  const [c2paSlow, setC2paSlow] = useState(false);
  const [submitSlow, setSubmitSlow] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const fileErrorRef = useRef<HTMLParagraphElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text.split("\n").filter((l) => l.trim().length > 0).length;

  // Client-side length gates (spec 3.3/3.4) — the server gates stay as a backstop.
  const gate: Gate =
    kind === "text"
      ? words === 0
        ? "empty"
        : words < thresholds.text.minWords
          ? "short"
          : words > thresholds.text.maxWords
            ? "long"
            : "ok"
      : kind === "code"
        ? text.trim().length === 0
          ? "empty"
          : lines < thresholds.code.minLines
            ? "short"
            : text.length > thresholds.code.maxChars
              ? "long"
              : "ok"
        : file !== null && fileError === null
          ? "ok"
          : "empty";

  const setPreviewFile = useCallback((f: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (!f) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(f);
    previewUrlRef.current = url;
    setPreview({ url, name: f.name, bytes: f.size });
  }, []);

  // Revoke the object URL when the component unmounts.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  // Progressive disclosure (spec 1.3): read the visit flag after hydration.
  useEffect(() => {
    try {
      setVisited(window.localStorage.getItem(VISITED_KEY) === "1");
    } catch {
      setVisited(false);
    }
  }, []);

  // Mark as returning visitor after the first successful verdict (API or local C2PA).
  const hasVerdict =
    phase === "done" ||
    (c2pa !== null && (c2pa.kind === "signed_ai" || c2pa.kind === "signed_other" || c2pa.kind === "invalid"));
  useEffect(() => {
    if (!hasVerdict) return;
    try {
      window.localStorage.setItem(VISITED_KEY, "1");
    } catch {
      /* storage unavailable — orientation just stays expanded */
    }
    setVisited(true);
  }, [hasVerdict]);

  // S-IMG-C2PA-LOADING: after 8 s on a slow channel, offer to skip the WASM check.
  useEffect(() => {
    if (phase !== "c2pa") {
      setC2paSlow(false);
      return;
    }
    const id = window.setTimeout(() => setC2paSlow(true), 8000);
    return () => window.clearTimeout(id);
  }, [phase]);

  // S-SUBMITTING: explain long waits after 6 s.
  useEffect(() => {
    if (phase !== "posting") {
      setSubmitSlow(false);
      return;
    }
    const id = window.setTimeout(() => setSubmitSlow(true), 6000);
    return () => window.clearTimeout(id);
  }, [phase]);

  // Focus the file-error alert when it appears (S-IMG-TOO-BIG / S-IMG-BAD-FORMAT).
  useEffect(() => {
    if (fileError) fileErrorRef.current?.focus();
  }, [fileError]);

  const reset = useCallback(() => {
    setResult(null);
    setSubmitError(null);
    setFileError(null);
    setC2pa(null);
    setPhase("idle");
    setPreviewFile(null);
  }, [setPreviewFile]);

  const switchTab = (next: DetectionKind) => {
    setKind(next);
    setText("");
    setFile(null);
    reset();
  };

  const onFile = useCallback(
    async (f: File | null) => {
      setResult(null);
      setSubmitError(null);
      setFileError(null);
      setC2pa(null);
      // Allow re-picking the same file name later.
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!f) {
        setFile(null);
        setPreviewFile(null);
        return;
      }
      // S-IMG-TOO-BIG: size gate runs BEFORE any preview is created.
      if (f.size > thresholds.image.maxBytes) {
        setFile(null);
        setPreviewFile(null);
        setFileError(fmt(copy.c2pa.tooBig, { size: formatBytes(f.size) }));
        return;
      }
      // S-IMG-BAD-FORMAT: honest refusal at the door (accept is narrowed to PNG/JPEG,
      // but drag-and-drop can still drop other types).
      if (f.type !== "image/png" && f.type !== "image/jpeg") {
        setFile(null);
        setPreviewFile(null);
        setFileError(copy.c2pa.badFormat);
        return;
      }
      setFile(f);
      setPreviewFile(f);
      setPhase("c2pa");
      const outcome = await checkC2pa(f);
      setC2pa(outcome);
      setPhase("idle");
    },
    [thresholds.image.maxBytes, copy.c2pa, setPreviewFile],
  );

  const skipC2pa = useCallback(() => {
    setC2pa({ kind: "none" });
    setPhase("idle");
  }, []);

  const submit = useCallback(async () => {
    // Client-side gate: short/over-limit inputs never consume the rate limit.
    if (kind !== "image" && gate !== "ok") return;
    if (kind === "image" && (!file || fileError)) return;
    setSubmitError(null);
    setResult(null);
    setPhase("posting");
    try {
      let payload: Record<string, string>;
      if (kind === "image") {
        let base64: string;
        try {
          base64 = await fileToBase64(file as File);
        } catch {
          setFileError(copy.c2pa.unreadable);
          setPhase("idle");
          return;
        }
        payload = { kind, imageBase64: base64 };
      } else {
        payload = { kind, text };
      }
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const jsonBody = (await res.json().catch(() => null)) as
        | (DetectionResponse & { message?: string })
        | null;
      if (!res.ok) {
        const detail = jsonBody?.message ?? `Request failed (HTTP ${res.status}).`;
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after"));
          setSubmitError({
            kind: "rate-limit",
            detail,
            retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 3600,
          });
        } else {
          setSubmitError({ kind: "http", status: res.status, detail });
        }
        setPhase("error");
        return;
      }
      if (!jsonBody) {
        setSubmitError({ kind: "network", detail: "Empty response from the server." });
        setPhase("error");
        return;
      }
      setResult(jsonBody);
      setPhase("done");
    } catch (e) {
      setSubmitError({ kind: "network", detail: (e as Error).message });
      setPhase("error");
    }
  }, [file, fileError, gate, kind, text, copy.c2pa.unreadable]);

  const canSubmit = phase !== "posting" && phase !== "c2pa" && gate === "ok";

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = TABS.findIndex((t) => t.kind === kind);
    const next = (idx + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    switchTab(TABS[next].kind);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="space-y-8" aria-busy={phase === "posting"}>
      {/* Tabs — roving tabindex, arrow-key navigation (spec 3.1 a11y) */}
      <div className="flex border border-ink" role="tablist" aria-label="Input type">
        {TABS.map((tab, i) => (
          <button
            key={tab.kind}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={kind === tab.kind}
            tabIndex={kind === tab.kind ? 0 : -1}
            onClick={() => switchTab(tab.kind)}
            onKeyDown={onTabKeyDown}
            className={cn(
              "min-h-11 flex-1 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.08em]",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink",
              kind === tab.kind ? "bg-ink text-paper" : "text-ink2 hover:bg-ink hover:text-paper",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Input */}
      {kind === "image" ? (
        <ImageInput
          file={file}
          dragOver={dragOver}
          setDragOver={setDragOver}
          onFile={onFile}
          fileInputRef={fileInputRef}
          c2pa={c2pa}
          checking={phase === "c2pa"}
          c2paSlow={c2paSlow}
          onSkipC2pa={skipC2pa}
          copy={copy}
        />
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // S-RES-STALE-GUARD: editing the input annuls the verdict; focus is
              // already in the textarea, so no screen-reader is left on dead live region.
              if (result || submitError) {
                setResult(null);
                setSubmitError(null);
                setPhase("idle");
              }
            }}
            rows={kind === "code" ? 14 : 10}
            placeholder={
              kind === "code"
                ? `Paste at least ${thresholds.code.minLines} lines of code (max ${thresholds.code.maxChars.toLocaleString("en-US")} chars)…`
                : `Paste at least ${thresholds.text.minWords} words of text (max ${thresholds.text.maxWords.toLocaleString("en-US")} words)…`
            }
            className={cn(
              "w-full resize-y border border-ink bg-paper p-4 text-sm leading-6 text-ink placeholder:text-ink2",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink",
              kind === "code" && "font-mono text-[13px]",
            )}
            aria-label={kind === "code" ? "Code to check" : "Text to check"}
          />
        </div>
      )}

      {/* P5 — first-visit orientation / returning-visitor collapsed link (spec 1.3, 3.1, 3.2) */}
      <FirstVisitHints copy={copy} kind={kind} visited={visited} />

      {/* P4 — counter + gate explanation (spec 3.3/3.4) */}
      {kind !== "image" ? (
        <GateCounter
          kind={kind}
          gate={gate}
          words={words}
          lines={lines}
          chars={text.length}
          copy={copy}
          thresholds={thresholds}
        />
      ) : null}

      {/* File-level input errors (oversize / bad format / unreadable) */}
      {fileError ? (
        <p
          ref={fileErrorRef}
          tabIndex={-1}
          role="alert"
          className="border border-ink px-4 py-3 text-sm font-medium focus:outline-none focus-visible:ring-1 focus-visible:ring-ink"
        >
          {fileError}
        </p>
      ) : null}

      {/* P7 — structured error cards (spec 3.5/3.6); the input above stays filled */}
      {submitError?.kind === "rate-limit" ? (
        <RateLimitCard error={submitError} copy={copy} isImage={kind === "image"} onRetry={submit} />
      ) : submitError ? (
        <ErrorCard error={submitError} copy={copy} onRetry={submit} />
      ) : null}

      {/* P6 — CTA + privacy caption */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            size="lg"
            disabled={!canSubmit}
            onClick={submit}
            className="min-h-11"
            aria-disabled={!canSubmit}
            aria-describedby={kind !== "image" && gate !== "ok" ? "gate-counter" : undefined}
          >
            {phase === "posting" ? "Checking…" : phase === "c2pa" ? "Reading signature…" : "Run detection"}
          </Button>
          {kind !== "image" && gate === "short" ? (
            <GateReason copy={copy} />
          ) : (
            <span className="font-mono text-[11px] text-ink2">
              {kind === "image"
                ? "C2PA signature is checked in your browser first — the file is uploaded only if no signed verdict exists."
                : "Text is sent to the server API for scoring. Rate limit: 30 checks/hour."}
            </span>
          )}
        </div>
        {phase === "posting" && submitSlow ? (
          <p className="font-mono text-[11px] text-ink2">
            {fmt(copy.submitting.slow, { n: Math.max(1, Math.round(text.length / 4)).toLocaleString("en-US") })}
          </p>
        ) : null}
      </div>

      {/* Local C2PA verdict (no API call needed) */}
      {c2pa && (c2pa.kind === "signed_ai" || c2pa.kind === "signed_other" || c2pa.kind === "invalid") ? (
        <C2paVerdict outcome={c2pa} copy={copy} preview={preview} onCheckAnyway={submit} />
      ) : null}

      {result ? (
        <DetectionResultView
          result={result}
          copy={copy}
          kind={kind}
          text={kind === "image" ? null : text}
          preview={kind === "image" ? preview : null}
        />
      ) : null}

      {/* How it works */}
      <HowItWorks copy={copy} />
    </div>
  );
}

// --- first-visit orientation ----------------------------------------------------

function FirstVisitHints({
  copy,
  kind,
  visited,
}: {
  copy: DetectorCopy;
  kind: DetectionKind;
  visited: boolean | null;
}) {
  if (visited === true) {
    // Returning visitor: orientation collapses into a single link line.
    return (
      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-[11px] text-ink2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink">
          {copy.firstVisitHints.returnLink}
        </summary>
        <div className="mt-1 space-y-1.5 border border-line p-4">
          <p className="text-sm text-ink2">{copy.firstVisitHints.text}</p>
          <p className="text-sm text-ink2">{copy.firstVisitHints.code}</p>
          <p className="text-sm text-ink2">{copy.firstVisitHints.image}</p>
        </div>
      </details>
    );
  }
  // First visit (and SSR/hydration placeholder): expanded, active tab's line only.
  return (
    <div className="space-y-1.5 border border-line p-4">
      <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
        {copy.firstVisitHints.title}
      </h2>
      <p className="text-sm text-ink2">{copy.firstVisitHints[kind]}</p>
    </div>
  );
}

// --- gate counter (P4) ------------------------------------------------------------

function GateCounter({
  kind,
  gate,
  words,
  lines,
  chars,
  copy,
  thresholds,
}: {
  kind: DetectionKind;
  gate: Gate;
  words: number;
  lines: number;
  chars: number;
  copy: DetectorCopy;
  thresholds: DetectorThresholds;
}) {
  const violated = gate === "short" || gate === "long";
  let message: string;
  if (kind === "code") {
    if (gate === "short") {
      message = fmt(copy.gates.tooShortCode, {
        lines: String(lines),
        min: String(thresholds.code.minLines),
      });
    } else if (gate === "long") {
      message = fmt(copy.gates.tooLongCode, {
        chars: chars.toLocaleString("en-US"),
        max: thresholds.code.maxChars.toLocaleString("en-US"),
      });
    } else {
      message = `${lines} non-empty lines · ${chars.toLocaleString("en-US")} chars`;
    }
  } else {
    if (gate === "short") {
      message = fmt(copy.gates.tooShortText, {
        words: String(words),
        min: String(thresholds.text.minWords),
      });
    } else if (gate === "long") {
      message = fmt(copy.gates.tooLongText, {
        words: words.toLocaleString("en-US"),
        max: thresholds.text.maxWords.toLocaleString("en-US"),
      });
    } else {
      message = `${words.toLocaleString("en-US")} words`;
    }
  }
  // Screen readers get a debounced copy so announcements fire on typing pauses.
  const announced = useDebouncedValue(message, 500);
  return (
    <p
      id="gate-counter"
      className={cn(
        "font-mono text-[11px] nums",
        violated ? "font-bold text-ink" : "text-ink2",
      )}
    >
      <span aria-hidden>{message}</span>
      <span aria-live="polite" className="sr-only">
        {announced}
      </span>
    </p>
  );
}

/** Reason line next to the disabled CTA for short inputs (spec 3.3). */
function GateReason({ copy }: { copy: DetectorCopy }) {
  const [before, after] = copy.gates.shortReason.split("“Honest limits”");
  return (
    <span className="text-[11px] leading-5 text-ink2">
      {before}
      <a href="#honest-limits" className="underline underline-offset-4 hover:bg-ink hover:text-paper">
        “Honest limits”
      </a>
      {after}
    </span>
  );
}

// --- image input --------------------------------------------------------------

function ImageInput({
  file,
  dragOver,
  setDragOver,
  onFile,
  fileInputRef,
  c2pa,
  checking,
  c2paSlow,
  onSkipC2pa,
  copy,
}: {
  file: File | null;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onFile: (f: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  c2pa: C2paOutcome | null;
  checking: boolean;
  c2paSlow: boolean;
  onSkipC2pa: () => void;
  copy: DetectorCopy;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "flex min-h-40 w-full flex-col items-center justify-center gap-2 border border-dashed border-ink p-6 text-center",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink",
          dragOver && "bg-line",
        )}
      >
        <span className="break-all font-mono text-xs font-bold uppercase tracking-[0.08em]">
          {file ? file.name : "Drop an image here or click to choose"}
        </span>
        <span className="text-sm text-ink2">PNG or JPEG, up to 8 MB</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        aria-label="Choose an image file"
      />
      {/* C2PA status lines live below the dropzone (R13, S-IMG-C2PA-LOADING) */}
      {checking ? (
        <div className="space-y-2">
          <p aria-live="polite" className="font-mono text-[11px] leading-5 text-ink2">
            {copy.c2pa.loading}
            {c2paSlow ? ` ${copy.c2pa.loadingSlow}` : ""}
          </p>
          {c2paSlow ? (
            <Button variant="secondary" className="min-h-11" onClick={onSkipC2pa}>
              {copy.c2pa.skip}
            </Button>
          ) : null}
        </div>
      ) : null}
      {!checking && c2pa?.kind === "none" ? (
        <p className="font-mono text-[11px] leading-5 text-ink2">{copy.c2pa.noManifest}</p>
      ) : null}
      {!checking && c2pa?.kind === "unavailable" ? (
        <p className="font-mono text-[11px] leading-5 text-ink2">
          {copy.c2pa.unavailable} <span className="break-all">({c2pa.detail})</span>
        </p>
      ) : null}
    </div>
  );
}

// --- image preview ---------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Thumbnail + file facts of the uploaded image. Dimensions are read once the image loads. */
function ImagePreview({ preview }: { preview: ImagePreviewState }) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // The image may already be cached/complete before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setDims({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [preview.url]);
  return (
    <div className="flex items-start gap-4">
      {/* key resets dimension state when a new file is picked */}
      {/* eslint-disable-next-line @next/next/no-img-element -- blob: object URLs are not supported by next/image */}
      <img
        key={preview.url}
        ref={imgRef}
        src={preview.url}
        alt={`Uploaded file: ${preview.name}`}
        onLoad={(e) => {
          const img = e.currentTarget;
          setDims({ w: img.naturalWidth, h: img.naturalHeight });
        }}
        className="h-24 w-24 shrink-0 border border-line bg-line object-cover sm:h-32 sm:w-32"
      />
      <div className="min-w-0 space-y-1 pt-0.5">
        <p className="break-all font-mono text-xs font-bold leading-5">{preview.name}</p>
        <p className="font-mono text-[11px] text-ink2 nums">
          {formatBytes(preview.bytes)}
          {dims ? ` · ${dims.w.toLocaleString("en-US")} × ${dims.h.toLocaleString("en-US")} px` : ""}
        </p>
      </div>
    </div>
  );
}

/** Collapsed-by-default block for secondary/technical detail (e-ink style disclosure). */
function TechnicalDetails({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group border border-line">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.08em] text-ink2 hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink">
        {label}
      </summary>
      <div className="border-t border-line px-4 py-3">{children}</div>
    </details>
  );
}

// --- error cards (S-RATE-LIMIT / S-NETWORK-ERR) ----------------------------------

/** HTTP 429 card with a Retry-After countdown; the input stays filled above. */
function RateLimitCard({
  error,
  copy,
  isImage,
  onRetry,
}: {
  error: Extract<SubmitError, { kind: "rate-limit" }>;
  copy: DetectorCopy;
  isImage: boolean;
  onRetry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const retryUntil = useMemo(() => Date.now() + error.retryAfterSeconds * 1000, [error]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // aria-live="off" on the timer: the text refreshes quietly, roughly on the minute.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = retryUntil - now;
  const done = remainingMs <= 0;
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));

  return (
    <div role="alert" className="space-y-3 border-[1.5px] border-ink p-4">
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="font-mono text-xs font-bold uppercase tracking-[0.08em] focus:outline-none"
      >
        {copy.rateLimit.title}
      </h3>
      <p className="text-sm leading-6">{copy.rateLimit.body}</p>
      {isImage ? <p className="text-sm leading-6 text-ink2">{copy.rateLimit.imageNote}</p> : null}
      <p aria-live="off" className="font-mono text-[11px] text-ink2 nums">
        {done ? copy.rateLimit.timerDone : fmt(copy.rateLimit.timer, { mm: String(minutes) })}
      </p>
      <div>
        <Button variant="secondary" className="min-h-11" disabled={!done} onClick={onRetry}>
          {copy.rateLimit.retry}
        </Button>
      </div>
    </div>
  );
}

/** Map a raw server/zod message to a human-readable reason (spec 3.6). */
function humanReason(detail: string, copy: DetectorCopy): string {
  if (/imageBase64|image/i.test(detail)) return copy.errors.badImage;
  return detail.split(";")[0].trim();
}

/** Network / 5xx / 400 card: readable message, Retry, raw detail hidden for bug reports. */
function ErrorCard({
  error,
  copy,
  onRetry,
}: {
  error: Exclude<SubmitError, { kind: "rate-limit" }>;
  copy: DetectorCopy;
  onRetry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const body =
    error.kind === "network"
      ? copy.errors.network
      : error.status >= 500
        ? fmt(copy.errors.server, { status: String(error.status) })
        : fmt(copy.errors.badInput, { reason: humanReason(error.detail, copy) });

  return (
    <div role="alert" className="space-y-3 border-[1.5px] border-ink p-4">
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="font-mono text-xs font-bold uppercase tracking-[0.08em] focus:outline-none"
      >
        {copy.errors.title}
      </h3>
      <p className="text-sm leading-6">{body}</p>
      <div className="flex flex-wrap items-center gap-4">
        <Button className="min-h-11" onClick={onRetry}>
          Retry
        </Button>
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-[11px] text-ink2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink">
            {copy.errors.technicalDetail}
          </summary>
          <p className="mt-1 break-all font-mono text-[11px] leading-5 text-ink2">{error.detail}</p>
        </details>
      </div>
    </div>
  );
}

// --- C2PA local verdict (S-IMG-C2PA-AI / NOAI / INVALID) --------------------------

export function C2paVerdict({
  outcome,
  copy,
  preview,
  onCheckAnyway,
}: {
  outcome: C2paOutcome;
  copy: DetectorCopy;
  preview?: ImagePreviewState | null;
  onCheckAnyway?: () => void;
}) {
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    headRef.current?.focus();
  }, []);

  if (outcome.kind === "invalid") {
    // S-IMG-C2PA-INVALID
    return (
      <section className="space-y-4 border-[1.5px] border-ink p-4 sm:p-6" aria-live="polite" aria-label="Detection result">
        <div ref={headRef} tabIndex={-1} className="space-y-2 focus:outline-none">
          <Badge variant="solid" className="px-3 py-1.5 text-xs">
            {copy.c2pa.invalidBadge}
          </Badge>
          <p className="text-base leading-7">{copy.c2pa.invalidFact}</p>
        </div>
        <p className="text-sm leading-6 text-ink2">{copy.c2paInvalidNote}</p>
        {onCheckAnyway ? (
          <div className="flex flex-wrap items-center gap-4">
            <Button className="min-h-11" onClick={onCheckAnyway}>
              {copy.c2pa.checkAnyway}
            </Button>
            <span className="text-[11px] leading-5 text-ink2">{copy.c2pa.checkAnywayNote}</span>
          </div>
        ) : null}
        {preview ? (
          <div className="border-t border-line pt-4">
            <ImagePreview preview={preview} />
          </div>
        ) : null}
        <TechnicalDetails label="Manifest details">
          <p className="font-mono text-xs leading-6 text-ink2">{outcome.detail}</p>
          <p className="pt-2 text-xs leading-5 text-ink2">{copy.shortDisclaimer}</p>
        </TechnicalDetails>
      </section>
    );
  }

  if (outcome.kind !== "signed_ai" && outcome.kind !== "signed_other") return null;
  const isAi = outcome.kind === "signed_ai";
  const byGenerator = outcome.generator ? ` by ${outcome.generator}` : "";

  // S-IMG-C2PA-AI / S-IMG-C2PA-NOAI
  return (
    <section className="space-y-4 border-[1.5px] border-ink p-4 sm:p-6" aria-live="polite" aria-label="Detection result">
      {/* Primary verdict — badge + signed fact (incl. the visible "verified locally" line) */}
      <div ref={headRef} tabIndex={-1} className="space-y-3 focus:outline-none">
        <Badge variant={STATUS_VARIANT.provenance_signed} className="px-3 py-1.5 text-xs">
          {isAi ? copy.statusLabels.provenance_signed : copy.c2pa.signedNoAiBadge}
        </Badge>
        <p className="text-base leading-7">
          {fmt(isAi ? copy.c2pa.signedAiFact : copy.c2pa.signedNoAiFact, { byGenerator })}
        </p>
      </div>

      {/* Thumbnail sits UNDER the verdict (spec 3.12) */}
      {preview ? (
        <div className="border-t border-line pt-4">
          <ImagePreview preview={preview} />
        </div>
      ) : null}

      <p className="text-sm leading-6">{isAi ? copy.c2pa.signedAiAction : copy.c2pa.signedNoAiAction}</p>
      {!isAi ? <p className="text-sm leading-6 text-ink2">{copy.c2paNoAiNote}</p> : null}

      <TechnicalDetails label="Manifest details">
        <p className="font-mono text-xs leading-6 text-ink2">
          Validation state: {outcome.validationState}
          {outcome.generator ? (
            <>
              <br />
              Claim generator: {outcome.generator}
            </>
          ) : null}
        </p>
      </TechnicalDetails>

      <p className="border-t border-line pt-3 text-xs leading-5 text-ink2">{copy.c2pa.signedDisclaimer}</p>
    </section>
  );
}

// --- server result (spec 3.0 anatomy) ----------------------------------------------

export function DetectionResultView({
  result,
  copy,
  kind,
  text,
  preview,
}: {
  result: DetectionResponse;
  copy: DetectorCopy;
  kind: DetectionKind;
  text: string | null;
  preview?: ImagePreviewState | null;
}) {
  const headRef = useRef<HTMLDivElement>(null);
  // Move focus to the verdict so SR/keyboard users start with the answer (spec 3.0 a11y).
  useEffect(() => {
    headRef.current?.focus();
  }, []);

  const { layers } = result;

  // S-NO-ML (spec 3.10, §4.5): no score AND the scoring layer is off/broken AND no
  // external fallback. Abstention (insufficient_data with a score) is a different thing.
  const isNoMl =
    kind !== "image" &&
    result.probability === null &&
    (layers.zeroshot.state === "unavailable" || layers.zeroshot.state === "error") &&
    layers.external.state !== "ok";
  // S-IMG-NO-SIGNALS (spec 3.17): image with no metadata signals and no external detector.
  const isImgNoSignals = kind === "image" && result.probability === null;

  if (isNoMl) return <NoMlCard result={result} copy={copy} />;
  if (isImgNoSignals) return <ImgNoSignalsCard result={result} copy={copy} preview={preview ?? null} />;

  const statusKey = (
    result.status in copy.interpretationByStatus ? result.status : null
  ) as keyof DetectorCopy["interpretationByStatus"] | null;
  const interpretation = statusKey ? copy.interpretationByStatus[statusKey] : null;
  const isAbstain = result.status === "insufficient_data";
  // S-EXT-ONLY (spec 3.9): the verdict rests on a single external signal.
  const extOnly =
    kind !== "image" &&
    result.probability !== null &&
    layers.zeroshot.state !== "ok" &&
    layers.external.state === "ok";

  // Notes triage (R8): action-level notes stay visible, the rest go to "Why this verdict".
  const borderline = result.notes.some((n) => n.startsWith("Borderline score"));
  const englishOnly =
    layers.attribution.state === "skipped" && /english-only/i.test(layers.attribution.detail ?? "");
  const hiddenNotes = result.notes.filter((n) => !n.startsWith("Borderline score"));

  return (
    <section
      className="space-y-6 border-[1.5px] border-ink p-4 sm:p-6"
      aria-live="polite"
      aria-label="Detection result"
    >
      {/* 1. [primary] Verdict row: badge + probability */}
      <div ref={headRef} tabIndex={-1} className="flex flex-wrap items-center gap-x-4 gap-y-3 focus:outline-none">
        <Badge variant={STATUS_VARIANT[result.status]} className="px-3 py-1.5 text-xs">
          {copy.statusLabels[result.status]}
        </Badge>
        {result.probability !== null ? (
          <span className="font-mono text-2xl font-bold leading-none nums">
            {(result.probability * 100).toFixed(0)}%
            <span className="ml-2 align-middle font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-ink2">
              AI probability
            </span>
          </span>
        ) : null}
      </div>

      {/* S-EXT-ONLY mandatory caution line */}
      {extOnly ? <p className="text-sm leading-6 text-ink2">{copy.extOnlyNote}</p> : null}

      {/* 2. [primary] Interpretation + action */}
      {interpretation ? (
        <div className="space-y-2">
          <p className="text-base leading-7">{interpretation}</p>
          {isAbstain ? (
            // S-RES-ABSTAIN: the action line becomes a teaching block (spec 3.7).
            <div className="space-y-1.5 border border-line p-4">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
                {copy.abstainBlock.title}
              </h3>
              <ul className="space-y-1.5">
                {copy.abstainBlock.items.map((item) => (
                  <li key={item} className="text-sm leading-6 text-ink2">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : statusKey ? (
            <p className="text-sm leading-6">{copy.verdictActions[statusKey]}</p>
          ) : null}
        </div>
      ) : null}

      {/* 3. [secondary] CI bar */}
      {result.probability !== null ? <CiBar probability={result.probability} ci={result.ci} /> : null}

      {/* 4. [secondary] Image thumbnail — UNDER the verdict, never above (R5) */}
      {preview ? (
        <div className="border-t border-line pt-4">
          <ImagePreview preview={preview} />
        </div>
      ) : null}

      {/* 5. [secondary-expanded] Spans: the evidence behind the verdict */}
      {text && result.spans.length > 0 ? (
        <SpanHighlights text={text} spans={result.spans} copy={copy} />
      ) : null}

      {/* 6. [secondary] Visible action-level notes */}
      {borderline ? <p className="text-sm leading-6 text-ink2">{copy.borderlineExtNote}</p> : null}
      {englishOnly ? <p className="text-sm leading-6 text-ink2">{copy.attributionEnglishNote}</p> : null}

      {/* 7. [secondary] Disclaimer: short line always visible, full text one click away */}
      <div className="space-y-1 border-t border-line pt-3">
        <p className="text-xs leading-5 text-ink2">{copy.shortDisclaimer}</p>
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-[11px] text-ink2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink">
            Full disclaimer
          </summary>
          <p className="mt-1 text-xs leading-5 text-ink2">{result.disclaimer}</p>
        </details>
      </div>

      {/* 8. [hidden] Remaining notes */}
      {hiddenNotes.length > 0 ? (
        <TechnicalDetails label="Why this verdict">
          <ul className="space-y-1.5">
            {hiddenNotes.map((note) => (
              <li key={note} className="text-sm leading-6 text-ink2">
                · {note}
              </li>
            ))}
          </ul>
        </TechnicalDetails>
      ) : null}

      {/* 9. [hidden] Model-family attribution (R7: experimental — below the evidence) */}
      {result.attribution && result.attribution.length > 0 ? (
        <TechnicalDetails label="Model-family guess (experimental)">
          <ul className="space-y-1.5">
            {result.attribution.map((a) => (
              <li key={a.family} className="flex items-center gap-3">
                <span className="w-28 min-w-0 truncate font-mono text-[11px] min-[400px]:w-40">{a.label}</span>
                <span className="h-3.5 flex-1" aria-hidden>
                  <span className="block h-full bg-ink" style={{ width: `${Math.round(a.probability * 100)}%` }} />
                </span>
                <span className="w-10 text-right font-mono text-[11px] nums">
                  {(a.probability * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="pt-2 text-xs leading-5 text-ink2">{copy.attributionFootnote}</p>
        </TechnicalDetails>
      ) : null}

      {/* 10. [hidden] Layer states */}
      <TechnicalDetails label="Signals & technical details">
        <LayerStates layers={result.layers} copy={copy} />
      </TechnicalDetails>
    </section>
  );
}

/** S-NO-ML (spec 3.10): the detector itself is off — said out loud, in primary. */
function NoMlCard({ result, copy }: { result: DetectionResponse; copy: DetectorCopy }) {
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    headRef.current?.focus();
  }, []);
  const [actionBefore, actionAfter] = copy.noMl.action.split("/methodology");
  return (
    <section
      className="space-y-4 border-[1.5px] border-ink p-4 sm:p-6"
      aria-live="polite"
      aria-label="Detection result"
    >
      <div ref={headRef} tabIndex={-1} className="focus:outline-none">
        <Badge variant="secondary" className="px-3 py-1.5 text-xs">
          {copy.noMl.badge}
        </Badge>
      </div>
      <p className="text-base leading-7">{copy.noMl.body}</p>
      <p className="text-sm leading-6 text-ink2">{copy.noMl.working}</p>
      <p className="text-sm leading-6">
        {actionBefore}
        <a href="/methodology" className="underline underline-offset-4 hover:bg-ink hover:text-paper">
          /methodology
        </a>
        {actionAfter}
      </p>
      <TechnicalDetails label="Signals & technical details">
        <LayerStates layers={result.layers} copy={copy} />
      </TechnicalDetails>
    </section>
  );
}

/** S-IMG-NO-SIGNALS (spec 3.17): nothing reliable to score — "no metadata ≠ human". */
function ImgNoSignalsCard({
  result,
  copy,
  preview,
}: {
  result: DetectionResponse;
  copy: DetectorCopy;
  preview: ImagePreviewState | null;
}) {
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    headRef.current?.focus();
  }, []);
  return (
    <section
      className="space-y-4 border-[1.5px] border-ink p-4 sm:p-6"
      aria-live="polite"
      aria-label="Detection result"
    >
      <div ref={headRef} tabIndex={-1} className="focus:outline-none">
        <Badge variant="secondary" className="px-3 py-1.5 text-xs">
          {copy.statusLabels.insufficient_data}
        </Badge>
      </div>
      <p className="text-base leading-7">{copy.imgNoSignals.body}</p>
      <p className="text-base leading-7">{copy.imgNoSignals.misread}</p>
      {preview ? (
        <div className="border-t border-line pt-4">
          <ImagePreview preview={preview} />
        </div>
      ) : null}
      <div className="space-y-1.5 border border-line p-4">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
          {copy.imgNoSignals.hintsTitle}
        </h3>
        <ul className="space-y-1.5">
          {copy.imgNoSignals.hints.map((hint) => (
            <li key={hint} className="text-sm leading-6 text-ink2">
              · {hint}
            </li>
          ))}
        </ul>
      </div>
      <TechnicalDetails label="Signals & technical details">
        <LayerStates layers={result.layers} copy={copy} />
      </TechnicalDetails>
    </section>
  );
}

/** E-ink probability bar with bootstrap CI overlay (axis labels per spec 3.0). */
function CiBar({ probability, ci }: { probability: number; ci: [number, number] | null }) {
  const p = Math.round(probability * 100);
  return (
    <div className="space-y-1">
      <div
        className="relative h-5 w-full border border-ink"
        role="img"
        aria-label={`AI probability ${p}%${ci ? `, confidence interval ${Math.round(ci[0] * 100)}–${Math.round(ci[1] * 100)}%` : ""}`}
      >
        {ci ? (
          <span
            className="absolute inset-y-0 bg-line"
            style={{ left: `${Math.round(ci[0] * 100)}%`, width: `${Math.max(1, Math.round((ci[1] - ci[0]) * 100))}%` }}
            aria-hidden
          />
        ) : null}
        <span className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${p}%` }} aria-hidden />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-ink2 nums">
        <span>← human-like</span>
        {ci ? (
          <span>
            90% CI {Math.round(ci[0] * 100)}–{Math.round(ci[1] * 100)}%
          </span>
        ) : (
          <span>CI unavailable</span>
        )}
        <span>AI-like →</span>
      </div>
    </div>
  );
}

/** S-SPANS-INTERACTION (spec 3.19): focusable span-buttons + a live readout row. */
function SpanHighlights({
  text,
  spans,
  copy,
}: {
  text: string;
  spans: { start: number; end: number; score: number }[];
  copy: DetectorCopy;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  // Larger alpha steps on small screens — an 8% wash is unreadable there (spec 3.19).
  const [smallScreen, setSmallScreen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setSmallScreen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  ordered.forEach((span, i) => {
    if (span.start > cursor) pieces.push(text.slice(cursor, span.start));
    const pct = Math.round(span.score * 100);
    const alpha = smallScreen ? 0.12 + span.score * 0.35 : 0.08 + span.score * 0.3;
    pieces.push(
      <button
        key={`${span.start}-${i}`}
        type="button"
        aria-label={fmt(copy.spanHints.ariaLabel, { x: String(pct) })}
        onMouseEnter={() => setHovered(i)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(i)}
        onBlur={() => setHovered(null)}
        onClick={() => setSelected(selected === i ? null : i)}
        className={cn(
          "text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink",
          selected === i && "outline outline-1 outline-ink",
        )}
        style={{ backgroundColor: `rgb(27 27 22 / ${alpha.toFixed(2)})` }}
      >
        {text.slice(span.start, span.end)}
      </button>,
    );
    cursor = span.end;
  });
  if (cursor < text.length) pieces.push(text.slice(cursor));

  // Sticky selection wins over hover for the live readout.
  const shown = selected ?? hovered;
  const shownPct = shown !== null ? Math.round(ordered[shown].score * 100) : null;

  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
        {copy.spanHints.title}
      </h3>
      <p className="text-xs leading-5 text-ink2">{copy.spanHints.subtitle}</p>
      <p className="font-mono text-[11px] text-ink2">{copy.spanHints.legend}</p>
      <p
        tabIndex={0}
        aria-label="Scrollable analysed text"
        className="max-h-72 overflow-y-auto whitespace-pre-wrap border border-line p-3 text-sm leading-7 [-webkit-overflow-scrolling:touch] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink"
      >
        {pieces}
      </p>
      <p aria-live="polite" className="min-h-5 font-mono text-[11px] text-ink2 nums">
        {shownPct !== null ? fmt(copy.spanHints.live, { x: String(shownPct) }) : " "}
      </p>
    </div>
  );
}

function LayerStates({
  layers,
  copy,
}: {
  layers: Record<"provenance" | "zeroshot" | "attribution" | "external", LayerReport>;
  copy: DetectorCopy;
}) {
  const stateLabel: Record<LayerReport["state"], string> = {
    ok: "ran",
    unavailable: "not configured",
    error: "error",
    skipped: "skipped",
  };
  return (
    <div className="space-y-1">
      {(Object.keys(layers) as (keyof typeof layers)[]).map((key) => (
        <div key={key} className="flex flex-wrap items-baseline gap-x-3 font-mono text-[11px]">
          <span className="w-44 shrink-0 font-bold">{copy.layerLabels[key]}</span>
          <span
            className={cn(
              "uppercase",
              layers[key].state === "ok" ? "text-ink" : "text-ink2",
            )}
          >
            [{stateLabel[layers[key].state]}]
          </span>
          {layers[key].detail ? <span className="min-w-0 flex-1 break-words text-ink2">{layers[key].detail}</span> : null}
        </div>
      ))}
    </div>
  );
}

function HowItWorks({ copy }: { copy: DetectorCopy }) {
  return (
    <section className="space-y-4 border-t border-ink pt-6">
      <h2 className="font-display text-xl font-bold uppercase leading-[0.94] tracking-[-0.02em]">
        How it works
      </h2>
      <div className="space-y-2">
        {copy.howItWorks.map((section) => (
          <details key={section.title} className="group border border-line">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.08em] hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink">
              {section.title}
            </summary>
            <p className="border-t border-line px-4 py-3 text-sm leading-6 text-ink2">{section.body}</p>
          </details>
        ))}
        {/* P9: Honest limits is reference material — collapsed by default (spec 2.1) */}
        <details id="honest-limits" className="group scroll-mt-4 border border-line">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.08em] hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink">
            Honest limits
          </summary>
          <ul className="space-y-1.5 border-t border-line px-4 py-3">
            {copy.honestLimits.map((limit) => (
              <li key={limit} className="text-sm leading-6 text-ink2">
                · {limit}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Failed to read the file"));
    reader.readAsDataURL(file);
  });
}
