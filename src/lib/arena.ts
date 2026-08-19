import type { ArenaCategory, ArenaEntry, BenchmarkEntry } from "@data/schemas/model.schema";
import type { ArenaCategoryMeta } from "@data/schemas/benchmarks-meta.schema";
import type { TrackedBenchmarkKey, TrackedBenchmarkValue } from "@/lib/benchmark-keys";

/**
 * Client-safe arena types and constants — no node builtins here, this module is
 * imported by client components. Data loading lives in @/lib/data/benchmarks.
 */

/** Tab order on /benchmarks: Overall → WebDev → Coding → Hard Prompts → Math → Vision. */
export const ARENA_CATEGORY_ORDER: ArenaCategory[] = [
  "text",
  "webdev",
  "coding",
  "hard-prompts",
  "math",
  "vision",
];

export const DEFAULT_ARENA_CATEGORY: ArenaCategory = "text";

export function isArenaCategory(value: string): value is ArenaCategory {
  return (ARENA_CATEGORY_ORDER as string[]).includes(value);
}

export interface BenchmarkValue {
  score: number;
  note?: string;
}

/** One model row inside a single arena category slice. */
export interface LeaderboardRow {
  modelSlug: string;
  modelName: string;
  modelProvider: string;
  openWeights: boolean;
  contextTokens: number;
  priceIn: number;
  priceOut: number;
  arena: ArenaEntry;
  /** All arena slices of this model, for the expandable panel. */
  arenaAll: Partial<Record<ArenaCategory, ArenaEntry>>;
  benchmarks: BenchmarkEntry[];
  /** One-line note for scores outside the comparable set (exotic/vendor-only). */
  benchmarksNote?: string;
  /** Comparable benchmark columns, keyed by TRACKED_BENCHMARKS key. */
  tracked: Partial<Record<TrackedBenchmarkKey, TrackedBenchmarkValue>>;
}

export interface CategorySlice {
  meta: ArenaCategoryMeta;
  rows: LeaderboardRow[];
}
