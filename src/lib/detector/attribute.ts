import type { AttributionConfig, DetectorThresholds } from "@data/schemas/detector.schema";
import { documentMeanLogprob, fetchEchoLogprobs, getLogprobProvider, MAX_SCORE_CHARS } from "./llm";
import type { AttributionEntry } from "./types";

/**
 * L2 model-family attribution (EXPERIMENTAL).
 *
 * The document is scored under one open proxy model per family (config:
 * data/detector/attribution.json). Family probabilities are
 * softmax(-negMeanLogP / temperature) — the text is most predictable to the
 * family that (approximately) wrote it. If the top-1/top-2 margin is below
 * thresholds.attribution.minMargin we refuse to guess and return "unknown".
 *
 * Known limits (shown in the UI): family granularity only, English only,
 * proxies are approximations of closed models. Marked experimental everywhere.
 */

export type AttributionOutcome =
  | { state: "ok"; attribution: AttributionEntry[] }
  | { state: "unavailable"; detail: string }
  | { state: "skipped"; detail: string }
  | { state: "error"; detail: string };

export async function runAttribution(
  input: string,
  config: AttributionConfig,
  thresholds: DetectorThresholds,
): Promise<AttributionOutcome> {
  const provider = getLogprobProvider();
  if (!provider) {
    return {
      state: "unavailable",
      detail: "No LLM provider key configured (DEEPINFRA_API_KEY or TOGETHER_API_KEY).",
    };
  }

  const scoredText = input.slice(0, MAX_SCORE_CHARS);
  try {
    const scores = await Promise.all(
      config.families.map(async (family) => {
        const result = await fetchEchoLogprobs(provider, family.proxyModel, scoredText);
        const meanLp = documentMeanLogprob(result.tokens);
        if (meanLp === null) throw new Error(`no logprobs from ${family.proxyModel}`);
        return { family, negMeanLogprob: -meanLp };
      }),
    );

    const temperature = thresholds.attribution.temperature;
    const maxScore = Math.max(...scores.map((s) => s.negMeanLogprob));
    const exps = scores.map((s) => Math.exp(-(s.negMeanLogprob - maxScore) / temperature));
    const total = exps.reduce((a, b) => a + b, 0);
    const ranked = scores
      .map((s, i) => ({
        family: s.family.family,
        label: s.family.label,
        probability: exps[i] / total,
      }))
      .sort((a, b) => b.probability - a.probability);

    const margin = ranked[0].probability - (ranked[1]?.probability ?? 0);
    if (margin < thresholds.attribution.minMargin) {
      return {
        state: "ok",
        attribution: [
          {
            family: "unknown",
            label: "Unknown — model families are too close to call",
            probability: 1,
          },
        ],
      };
    }
    return { state: "ok", attribution: ranked.slice(0, thresholds.attribution.topK) };
  } catch (e) {
    return { state: "error", detail: (e as Error).message.slice(0, 300) };
  }
}
