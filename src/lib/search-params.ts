/**
 * URL search-param parsing helpers — client-safe (no node builtins). Shared by
 * server pages (searchParams) and client components (useSearchParams), hence
 * the `string | string[] | null | undefined` input tolerance.
 */

/** Cap URL-provided volumes so crafted links can't produce absurd/overflowing numbers. */
export const MAX_VOLUME_PARAM = 1e9;

/** Cached-input share is a percent in [0, CACHE_PCT_MAX] (0 is a valid value). */
export const CACHE_PCT_MAX = 90;

export function first(value: string | string[] | null | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

/** Positive number param capped at `max`; anything else falls back. */
export function parsePositiveInt(
  raw: string | string[] | null | undefined,
  fallback: number,
  max: number = MAX_VOLUME_PARAM,
): number {
  const n = Number(first(raw));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
}

/** Cached-input share, percent 0–90; invalid/missing → 0. */
export function parseCachePct(raw: string | string[] | null | undefined): number {
  const n = Number(first(raw));
  return Number.isFinite(n) && n >= 0 && n <= CACHE_PCT_MAX ? n : 0;
}
