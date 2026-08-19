/**
 * Value score helpers — client-safe, no node builtins.
 *
 * Value = arena score per $1 of blended price. The blended price assumes a
 * 3:1 input:output token mix (typical chat/agent workload heuristic).
 */

/** Blended $/1M under a 3:1 input:output mix. */
export function blendedPrice(inputPer1M: number, outputPer1M: number): number {
  return (3 * inputPer1M + outputPer1M) / 4;
}

/** Arena points per $1 of blended price, rounded to whole points; undefined when no arena data. */
export function valueScore(
  arenaScore: number | undefined,
  inputPer1M: number,
  outputPer1M: number,
): number | undefined {
  if (arenaScore === undefined) return undefined;
  const blended = blendedPrice(inputPer1M, outputPer1M);
  if (blended <= 0) return undefined;
  return Math.round(arenaScore / blended);
}

/** Effective input $/1M when `cacheShare` (0..1) of input tokens hits the cache. */
export function effectiveInputPrice(
  inputPer1M: number,
  cachedInputPer1M: number | undefined,
  cacheShare: number,
): number {
  const cached = cachedInputPer1M ?? inputPer1M;
  return (1 - cacheShare) * inputPer1M + cacheShare * cached;
}

/** Monthly cost for a scenario of rpd requests/day, in/out tokens per request, cache share 0..1. */
export function monthlyCost(
  requestsPerDay: number,
  inputTokens: number,
  outputTokens: number,
  cacheShare: number,
  inputPer1M: number,
  outputPer1M: number,
  cachedInputPer1M?: number,
): number {
  const monthlyRequests = requestsPerDay * 30;
  return (
    (monthlyRequests * inputTokens * effectiveInputPrice(inputPer1M, cachedInputPer1M, cacheShare)) / 1_000_000 +
    (monthlyRequests * outputTokens * outputPer1M) / 1_000_000
  );
}
