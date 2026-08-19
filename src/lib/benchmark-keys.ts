import type { BenchmarkEntry, Model } from "@data/schemas/model.schema";

/**
 * The benchmark columns tracked on /benchmarks and /compare — single source of
 * truth for which scores are comparable across models. Client-safe: no node
 * builtins.
 *
 * Prefixes are deliberately exact: "Terminal-Bench 2.1" must NOT match
 * Terminal-Bench 2.0 entries (different harness, silently incomparable).
 */
export const TRACKED_BENCHMARKS = [
  { key: "swe-pro", prefix: "SWE-bench Pro", label: "SWE-bench Pro" },
  { key: "terminal", prefix: "Terminal-Bench 2.1", label: "Terminal-Bench" },
  { key: "gpqa", prefix: "GPQA", label: "GPQA" },
  { key: "hle", prefix: "Humanity's Last Exam", label: "HLE" },
] as const;

export type TrackedBenchmarkKey = (typeof TRACKED_BENCHMARKS)[number]["key"];

export interface TrackedBenchmarkValue {
  score: number;
  note?: string;
}

/** First benchmark entry whose name starts with `prefix` (exact version included). */
export function findByPrefix(
  model: { benchmarks?: BenchmarkEntry[] } | Pick<Model, "benchmarks">,
  prefix: string,
): TrackedBenchmarkValue | undefined {
  const hit = model.benchmarks?.find((b) => b.name.startsWith(prefix));
  return hit ? { score: hit.score, note: hit.note } : undefined;
}

/** All tracked benchmarks of a model, keyed by TRACKED_BENCHMARKS key. */
export function trackedBenchmarksOf(
  model: { benchmarks?: BenchmarkEntry[] },
): Partial<Record<TrackedBenchmarkKey, TrackedBenchmarkValue>> {
  return Object.fromEntries(
    TRACKED_BENCHMARKS.flatMap((t) => {
      const v = findByPrefix(model, t.prefix);
      return v ? [[t.key, v]] : [];
    }),
  );
}
