/**
 * Minimal OpenAI-compatible *completions* client with `echo: true` support.
 *
 * Why completions and not chat: AI-detection scoring needs log-probabilities of
 * the PROMPT tokens (how surprising the submitted text is to a model). The chat
 * API only returns logprobs of tokens the model generated, so the legacy
 * completions endpoint with echo:true + max_tokens small is required.
 *
 * Providers (first configured wins):
 *  - DeepInfra  https://api.deepinfra.com/v1/openai  (DEEPINFRA_API_KEY)
 *  - Together   https://api.together.xyz/v1          (TOGETHER_API_KEY)
 *
 * SMOKE-TEST TODO: echo+max_tokens behavior on DeepInfra/Together must be
 * verified with real keys before launch — the cross-verification notes flag
 * prompt-logprobs as the main integration risk. If echo is rejected by a
 * provider, this client fails closed (layer reports "error", verdict is built
 * without it) rather than fabricating numbers.
 */

export interface TokenLogprob {
  token: string;
  logprob: number | null;
  /** Char offset of the token start within the prompt, when the provider reports it. */
  offset: number;
}

export interface EchoLogprobsResult {
  tokens: TokenLogprob[];
  provider: string;
  model: string;
}

interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export function getLogprobProvider(): ProviderConfig | null {
  if (process.env.DEEPINFRA_API_KEY) {
    return {
      name: "deepinfra",
      baseUrl: "https://api.deepinfra.com/v1/openai",
      apiKey: process.env.DEEPINFRA_API_KEY,
    };
  }
  if (process.env.TOGETHER_API_KEY) {
    return {
      name: "together",
      baseUrl: "https://api.together.xyz/v1",
      apiKey: process.env.TOGETHER_API_KEY,
    };
  }
  return null;
}

/** Bound per-request cost: score at most the first ~24K chars (~6K tokens). */
export const MAX_SCORE_CHARS = 24_000;

const REQUEST_TIMEOUT_MS = 30_000;

interface CompletionLogprobs {
  tokens?: string[];
  token_logprobs?: (number | null)[];
  text_offset?: number[];
}

interface CompletionResponse {
  choices?: { logprobs?: CompletionLogprobs }[];
  error?: { message?: string };
}

export async function fetchEchoLogprobs(
  provider: ProviderConfig,
  model: string,
  prompt: string,
): Promise<EchoLogprobsResult> {
  const res = await fetch(`${provider.baseUrl}/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      max_tokens: 1,
      echo: true,
      logprobs: 1,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${provider.name} completions HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as CompletionResponse;
  if (json.error) {
    throw new Error(`${provider.name} completions error: ${json.error.message ?? "unknown"}`);
  }
  const lp = json.choices?.[0]?.logprobs;
  if (!lp?.tokens || !lp.token_logprobs || lp.tokens.length === 0) {
    throw new Error(`${provider.name} returned no echo logprobs (echo unsupported?)`);
  }

  // Char offsets: use text_offset when present, else reconstruct by
  // concatenating the decoded token strings (byte-identical for these models).
  const tokens: TokenLogprob[] = [];
  let cursor = 0;
  for (let i = 0; i < lp.tokens.length; i += 1) {
    const token = lp.tokens[i];
    const offset = lp.text_offset?.[i] ?? cursor;
    tokens.push({ token, logprob: lp.token_logprobs[i] ?? null, offset });
    cursor = offset + token.length;
  }
  return { tokens, provider: provider.name, model };
}

/** Mean log-probability of prompt tokens whose start offset falls in [start, end). */
export function meanLogprobInRange(tokens: TokenLogprob[], start: number, end: number): number | null {
  let sum = 0;
  let n = 0;
  for (const t of tokens) {
    if (t.offset >= start && t.offset < end && t.logprob !== null) {
      sum += t.logprob;
      n += 1;
    }
  }
  return n > 0 ? sum / n : null;
}

/** Document-level mean log-probability over all prompt tokens. */
export function documentMeanLogprob(tokens: TokenLogprob[]): number | null {
  const values = tokens.filter((t) => t.logprob !== null).map((t) => t.logprob as number);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
