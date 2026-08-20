"use client";

import { useCallback, useRef, useState } from "react";
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

export function AiDetector({ initialKind, copy, thresholds }: Props) {
  const [kind, setKind] = useState<DetectionKind>(initialKind);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResponse | null>(null);
  const [c2pa, setC2pa] = useState<C2paOutcome | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text.split("\n").filter((l) => l.trim().length > 0).length;

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setC2pa(null);
    setPhase("idle");
  }, []);

  const switchTab = (next: DetectionKind) => {
    setKind(next);
    reset();
  };

  const onFile = useCallback(
    async (f: File | null) => {
      setFile(f);
      setResult(null);
      setError(null);
      setC2pa(null);
      if (!f) return;
      if (f.size > thresholds.image.maxBytes) {
        setError(`Image exceeds the ${Math.round(thresholds.image.maxBytes / 1024 / 1024)} MB limit.`);
        return;
      }
      setPhase("c2pa");
      const outcome = await checkC2pa(f);
      setC2pa(outcome);
      setPhase("idle");
    },
    [thresholds.image.maxBytes],
  );

  const submit = useCallback(async () => {
    setError(null);
    setResult(null);
    setPhase("posting");
    try {
      let payload: Record<string, string>;
      if (kind === "image") {
        if (!file) {
          setError("Choose an image first.");
          setPhase("idle");
          return;
        }
        const base64 = await fileToBase64(file);
        payload = { kind, imageBase64: base64 };
      } else {
        payload = { kind, text };
      }
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const jsonBody = (await res.json()) as DetectionResponse & { message?: string };
      if (!res.ok) {
        setError(jsonBody.message ?? `Request failed (HTTP ${res.status}).`);
        setPhase("error");
        return;
      }
      setResult(jsonBody);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [file, kind, text]);

  const canSubmit =
    phase !== "posting" &&
    phase !== "c2pa" &&
    (kind === "image" ? file !== null && !error : text.trim().length > 0);

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex border border-ink" role="tablist" aria-label="Input type">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            aria-selected={kind === tab.kind}
            onClick={() => switchTab(tab.kind)}
            className={cn(
              "min-h-11 flex-1 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.08em]",
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
        />
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (result || error) reset();
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
          <p className="font-mono text-[11px] text-ink2 nums">
            {kind === "code" ? (
              <>
                {lines} non-empty lines
                {lines < thresholds.code.minLines && lines > 0
                  ? ` — need ${thresholds.code.minLines}+`
                  : ""}
                {" · "}
                {text.length.toLocaleString("en-US")} chars
              </>
            ) : (
              <>
                {words.toLocaleString("en-US")} words
                {words < thresholds.text.minWords && words > 0 ? ` — need ${thresholds.text.minWords}+` : ""}
              </>
            )}
          </p>
        </div>
      )}

      {error ? (
        <p role="alert" className="border border-ink px-4 py-3 text-sm font-medium">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          size="lg"
          disabled={!canSubmit}
          onClick={submit}
          className="min-h-11"
        >
          {phase === "posting" ? "Checking…" : phase === "c2pa" ? "Reading signature…" : "Run detection"}
        </Button>
        <span className="font-mono text-[11px] text-ink2">
          {kind === "image"
            ? "C2PA signature is checked in your browser first — the file is uploaded only if no signed verdict exists."
            : "Text is sent to the server API for scoring. Rate limit: 30 checks/hour."}
        </span>
      </div>

      {/* Local C2PA verdict (no API call needed) */}
      {c2pa && (c2pa.kind === "signed_ai" || c2pa.kind === "signed_other" || c2pa.kind === "invalid") ? (
        <C2paVerdict outcome={c2pa} copy={copy} />
      ) : null}

      {result ? <DetectionResultView result={result} copy={copy} text={kind === "image" ? null : text} /> : null}

      {/* How it works */}
      <HowItWorks copy={copy} />
    </div>
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
}: {
  file: File | null;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onFile: (f: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  c2pa: C2paOutcome | null;
  checking: boolean;
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
          dragOver && "bg-line",
        )}
      >
        <span className="font-mono text-xs font-bold uppercase tracking-[0.08em]">
          {file ? file.name : "Drop an image here or click to choose"}
        </span>
        <span className="text-sm text-ink2">PNG or JPEG, up to 8 MB</span>
        {checking ? (
          <span className="font-mono text-[11px] text-ink2">Checking C2PA signature in your browser…</span>
        ) : null}
        {c2pa?.kind === "none" ? (
          <span className="font-mono text-[11px] text-ink2">
            No C2PA manifest — will check metadata fingerprints and (if configured) an external detector.
          </span>
        ) : null}
        {c2pa?.kind === "unavailable" ? (
          <span className="font-mono text-[11px] text-ink2">C2PA check failed ({c2pa.detail}) — continuing without it.</span>
        ) : null}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        aria-label="Choose an image file"
      />
    </div>
  );
}

// --- C2PA local verdict --------------------------------------------------------

function C2paVerdict({ outcome, copy }: { outcome: C2paOutcome; copy: DetectorCopy }) {
  if (outcome.kind === "invalid") {
    return (
      <section className="space-y-3 border-[1.5px] border-ink p-4 sm:p-6">
        <Badge variant="solid">Invalid signature</Badge>
        <p className="text-sm leading-6">{outcome.detail}</p>
        <p className="text-sm text-ink2">{copy.shortDisclaimer}</p>
      </section>
    );
  }
  if (outcome.kind !== "signed_ai" && outcome.kind !== "signed_other") return null;
  const isAi = outcome.kind === "signed_ai";
  return (
    <section className="space-y-3 border-[1.5px] border-ink p-4 sm:p-6">
      <Badge variant={STATUS_VARIANT.provenance_signed}>
        {isAi ? copy.statusLabels.provenance_signed : "Cryptographically signed (no AI claim)"}
      </Badge>
      <p className="text-sm leading-6">
        This file carries a valid C2PA content signature
        {outcome.generator ? (
          <>
            {" "}issued by <span className="font-mono font-bold">{outcome.generator}</span>
          </>
        ) : null}
        .{" "}
        {isAi
          ? "The signed manifest identifies the content as AI-generated — this is a definitive provenance answer, no statistical detection was needed."
          : "The manifest does not claim AI generation (e.g. a camera-signed photo). Provenance is verified; content origin is whatever the signer declared."}
      </p>
      <p className="font-mono text-[11px] text-ink2">
        Verified locally in your browser with the C2PA open SDK — the file was not uploaded for this verdict. Validation state: {outcome.validationState}.
      </p>
    </section>
  );
}

// --- server result -------------------------------------------------------------

function DetectionResultView({
  result,
  copy,
  text,
}: {
  result: DetectionResponse;
  copy: DetectorCopy;
  text: string | null;
}) {
  return (
    <section className="space-y-6 border-[1.5px] border-ink p-4 sm:p-6" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={STATUS_VARIANT[result.status]} className="px-2.5 py-1 text-[11px]">
          {copy.statusLabels[result.status]}
        </Badge>
        {result.probability !== null ? (
          <span className="font-mono text-sm font-bold nums">
            {(result.probability * 100).toFixed(0)}% AI probability
          </span>
        ) : null}
      </div>

      {result.probability !== null ? (
        <CiBar probability={result.probability} ci={result.ci} />
      ) : (
        <p className="text-sm text-ink2">
          No numeric score — see below which signals ran and why no verdict was produced.
        </p>
      )}

      {result.attribution && result.attribution.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
            Likely model family (experimental)
          </h3>
          <ul className="space-y-1.5">
            {result.attribution.map((a) => (
              <li key={a.family} className="flex items-center gap-3">
                <span className="w-40 min-w-0 truncate font-mono text-[11px]">{a.label}</span>
                <span className="h-3.5 flex-1" aria-hidden>
                  <span className="block h-full bg-ink" style={{ width: `${Math.round(a.probability * 100)}%` }} />
                </span>
                <span className="w-10 text-right font-mono text-[11px] nums">
                  {(a.probability * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {text && result.spans.length > 0 ? <SpanHighlights text={text} spans={result.spans} /> : null}

      {result.notes.length > 0 ? (
        <ul className="space-y-1.5 border-t border-line pt-4">
          {result.notes.map((note) => (
            <li key={note} className="text-sm leading-6 text-ink2">
              · {note}
            </li>
          ))}
        </ul>
      ) : null}

      <LayerStates layers={result.layers} copy={copy} />

      <p className="border-t border-ink pt-3 text-[13px] leading-6 text-ink2">{result.disclaimer}</p>
    </section>
  );
}

/** E-ink probability bar with bootstrap CI overlay. */
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
        <span>0% human</span>
        {ci ? (
          <span>
            CI {Math.round(ci[0] * 100)}–{Math.round(ci[1] * 100)}%
          </span>
        ) : (
          <span>CI unavailable</span>
        )}
        <span>100% AI</span>
      </div>
    </div>
  );
}

function SpanHighlights({ text, spans }: { text: string; spans: { start: number; end: number; score: number }[] }) {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  ordered.forEach((span, i) => {
    if (span.start > cursor) pieces.push(text.slice(cursor, span.start));
    // ink shade by score: 0 → almost invisible, 1 → solid ink text on dark wash
    const alpha = 0.08 + span.score * 0.3;
    pieces.push(
      <span
        key={`${span.start}-${i}`}
        title={`AI-likeness score: ${(span.score * 100).toFixed(0)}%`}
        className="cursor-help"
        style={{ backgroundColor: `rgb(27 27 22 / ${alpha.toFixed(2)})` }}
      >
        {text.slice(span.start, span.end)}
      </span>,
    );
    cursor = span.end;
  });
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
        Segment analysis — darker = more AI-like (hover for the score)
      </h3>
      <p className="max-h-72 overflow-y-auto whitespace-pre-wrap border border-line p-3 text-sm leading-7">
        {pieces}
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
    <div className="space-y-1 border-t border-line pt-4">
      <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
        Signals used
      </h3>
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
            <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.08em] hover:bg-ink hover:text-paper">
              {section.title}
            </summary>
            <p className="border-t border-line px-4 py-3 text-sm leading-6 text-ink2">{section.body}</p>
          </details>
        ))}
      </div>
      <div className="space-y-2 pt-2">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
          Honest limits
        </h3>
        <ul className="space-y-1.5">
          {copy.honestLimits.map((limit) => (
            <li key={limit} className="text-sm leading-6 text-ink2">
              · {limit}
            </li>
          ))}
        </ul>
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
