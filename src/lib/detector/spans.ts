import type { DetectionKind, SpanScore } from "./types";

/**
 * Span splitting: text is split into sentences, code into logical lines.
 * Offsets are char indices into the original input so the UI can highlight.
 */

export interface Span {
  start: number;
  end: number;
  text: string;
}

const SENTENCE_RE = /[^.!?\n]+[.!?]+["'”’)\]]*\s*|[^.!?\n]+$/g;

/** Split prose into sentence spans. Fragments shorter than `minChars` are merged forward. */
export function splitTextIntoSpans(text: string, minChars = 24): Span[] {
  const spans: Span[] = [];
  for (const match of text.matchAll(SENTENCE_RE)) {
    const raw = match[0];
    const start = match.index + (raw.length - raw.trimStart().length);
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const span: Span = { start, end: start + trimmed.length, text: trimmed };
    const prev = spans[spans.length - 1];
    if (prev && prev.text.length < minChars) {
      prev.end = span.end;
      prev.text = text.slice(prev.start, prev.end);
    } else {
      spans.push(span);
    }
  }
  return spans;
}

/** Split code into line spans; blank runs are skipped. */
export function splitCodeIntoSpans(code: string): Span[] {
  const spans: Span[] = [];
  let offset = 0;
  for (const line of code.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      const start = offset + (line.length - line.trimStart().length);
      spans.push({ start, end: start + trimmed.length, text: trimmed });
    }
    offset += line.length + 1;
  }
  return spans;
}

export function splitIntoSpans(input: string, kind: DetectionKind): Span[] {
  return kind === "code" ? splitCodeIntoSpans(input) : splitTextIntoSpans(input);
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countNonEmptyLines(code: string): number {
  return code.split("\n").filter((l) => l.trim().length > 0).length;
}

/** Bootstrap CI over per-span scores: resample spans, recompute the mean each time. */
export function bootstrapCi(
  spanScores: number[],
  resamples: number,
  level: number,
  rng: () => number = Math.random,
): [number, number] | null {
  if (spanScores.length < 3) return null;
  const means: number[] = [];
  for (let r = 0; r < resamples; r += 1) {
    let sum = 0;
    for (let i = 0; i < spanScores.length; i += 1) {
      sum += spanScores[Math.floor(rng() * spanScores.length)];
    }
    means.push(sum / spanScores.length);
  }
  means.sort((a, b) => a - b);
  const alpha = (1 - level) / 2;
  const lo = means[Math.max(0, Math.floor(alpha * resamples))];
  const hi = means[Math.min(resamples - 1, Math.ceil((1 - alpha) * resamples) - 1)];
  return [clamp01(lo), clamp01(hi)];
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sigmoid calibration: Binoculars-style score (lower = more AI-like) → probability. */
export function calibrateScore(score: number, midpoint: number, scale: number): number {
  return clamp01(1 / (1 + Math.exp(scale * (score - midpoint))));
}

export function emptySpans(): SpanScore[] {
  return [];
}
