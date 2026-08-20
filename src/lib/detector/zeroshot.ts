import type { DetectorThresholds } from "@data/schemas/detector.schema";
import { getLogprobProvider, fetchEchoLogprobs, meanLogprobInRange, MAX_SCORE_CHARS } from "./llm";
import { bootstrapCi, calibrateScore, clamp01, mean, splitIntoSpans } from "./spans";
import type { SpanScore } from "./types";

/**
 * L1 zero-shot scoring — a Binoculars-style approximation.
 *
 * True Binoculars needs per-token distributions (perplexity of the text under
 * model A, divided by the cross-perplexity where observer model B proposes
 * tokens). Public APIs expose only top-k logprobs, so we approximate:
 * for each span we take the mean prompt-token log-probability under two models
 * (performer A and observer B) and score the ratio
 *     r = negMeanLogP(A) / negMeanLogP(B)
 * AI text sits close to what LLMs themselves produce, so r < ~1; human text is
 * more surprising to both and r drifts above 1. A sigmoid (midpoint/scale from
 * data/detector/thresholds.json) maps r to a probability.
 *
 * SMOKE-TEST TODO: verify echo-logprobs on the live provider and re-fit
 * midpoint/scale on a calibration corpus before trusting the zones.
 *
 * Model pairs verified against the DeepInfra catalog (GET /models/list) on
 * 2026-08-20. The base Llama-3.1-8B is no longer hosted, so the text pair uses
 * two different families as performer/observer (valid for cross-perplexity).
 */

const MODEL_PAIRS: Record<"text" | "code", { performer: string; observer: string }> = {
  text: {
    performer: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    observer: "Qwen/Qwen2.5-7B-Instruct",
  },
  code: {
    performer: "Qwen/Qwen2.5-Coder-7B",
    observer: "Qwen/Qwen2.5-Coder-32B-Instruct",
  },
};

export interface ZeroshotOk {
  state: "ok";
  provider: string;
  probability: number;
  ci: [number, number] | null;
  spans: SpanScore[];
  truncated: boolean;
  tokensScored: number;
}

export type ZeroshotOutcome =
  | ZeroshotOk
  | { state: "unavailable"; detail: string }
  | { state: "error"; detail: string };

export async function runZeroshot(
  input: string,
  kind: "text" | "code",
  thresholds: DetectorThresholds,
): Promise<ZeroshotOutcome> {
  const provider = getLogprobProvider();
  if (!provider) {
    return {
      state: "unavailable",
      detail: "No LLM provider key configured (DEEPINFRA_API_KEY or TOGETHER_API_KEY).",
    };
  }

  const pair = MODEL_PAIRS[kind];
  const calibration = thresholds[kind];
  const scoredText = input.slice(0, MAX_SCORE_CHARS);
  const truncated = scoredText.length < input.length;
  const spans = splitIntoSpans(scoredText, kind);
  if (spans.length === 0) {
    return { state: "error", detail: "No scorable spans in input." };
  }

  try {
    const [a, b] = await Promise.all([
      fetchEchoLogprobs(provider, pair.performer, scoredText),
      fetchEchoLogprobs(provider, pair.observer, scoredText),
    ]);

    const spanScores: SpanScore[] = [];
    for (const span of spans) {
      const lpA = meanLogprobInRange(a.tokens, span.start, span.end);
      const lpB = meanLogprobInRange(b.tokens, span.start, span.end);
      if (lpA === null || lpB === null) continue;
      const ratio = -lpA / Math.max(-lpB, 1e-6);
      spanScores.push({
        start: span.start,
        end: span.end,
        score: calibrateScore(ratio, calibration.scoreMidpoint, calibration.scoreScale),
      });
    }
    if (spanScores.length === 0) {
      return { state: "error", detail: "Provider returned logprobs that do not align with spans." };
    }

    const values = spanScores.map((s) => s.score);
    return {
      state: "ok",
      provider: provider.name,
      probability: clamp01(mean(values)),
      ci: bootstrapCi(values, thresholds.bootstrap.resamples, thresholds.bootstrap.ciLevel),
      spans: spanScores,
      truncated,
      tokensScored: a.tokens.length,
    };
  } catch (e) {
    return { state: "error", detail: (e as Error).message.slice(0, 300) };
  }
}
