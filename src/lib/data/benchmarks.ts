import fs from "node:fs";
import path from "node:path";
import { benchmarksMetaSchema, type BenchmarksMeta } from "@data/schemas/benchmarks-meta.schema";
import type { ArenaCategory, Model } from "@data/schemas/model.schema";
import { getAllModels } from "@/lib/data/models";
import { getProviderName } from "@/lib/data/providers";
import { trackedBenchmarksOf } from "@/lib/benchmark-keys";
import {
  ARENA_CATEGORY_ORDER,
  type CategorySlice,
  type LeaderboardRow,
} from "@/lib/arena";

export {
  ARENA_CATEGORY_ORDER,
  DEFAULT_ARENA_CATEGORY,
  isArenaCategory,
  type BenchmarkValue,
  type CategorySlice,
  type LeaderboardRow,
} from "@/lib/arena";

const metaFile = path.join(process.cwd(), "data", "meta", "benchmarks.json");

let metaCache: BenchmarksMeta | null = null;

export function getBenchmarksMeta(): BenchmarksMeta {
  if (metaCache) return metaCache;
  metaCache = benchmarksMetaSchema.parse(JSON.parse(fs.readFileSync(metaFile, "utf8")));
  return metaCache;
}

function toRow(m: Model, category: ArenaCategory): LeaderboardRow | null {
  const arena = m.arena?.[category];
  if (!arena) return null;
  const price = m.pricing[0];
  return {
    modelSlug: m.slug,
    modelName: m.name,
    modelProvider: getProviderName(m.provider),
    openWeights: m.openWeights,
    contextTokens: m.context.tokens,
    priceIn: price.inputPer1M,
    priceOut: price.outputPer1M,
    arena,
    arenaAll: m.arena ?? {},
    benchmarks: m.benchmarks ?? [],
    benchmarksNote: m.benchmarksNote,
    tracked: trackedBenchmarksOf(m),
  };
}

/** Rows for one arena slice — only models present in that board's top-20, sorted by Elo desc. */
export function getCategoryRows(category: ArenaCategory): LeaderboardRow[] {
  return getAllModels()
    .map((m) => toRow(m, category))
    .filter((r): r is LeaderboardRow => r !== null)
    .sort((a, b) => b.arena.elo - a.arena.elo);
}

/** All slices keyed by category — serializable payload for the client explorer. */
export function getAllCategorySlices(): Record<ArenaCategory, CategorySlice> {
  const meta = getBenchmarksMeta();
  return Object.fromEntries(
    ARENA_CATEGORY_ORDER.map((cat) => [cat, { meta: meta.categories[cat], rows: getCategoryRows(cat) }]),
  ) as Record<ArenaCategory, CategorySlice>;
}

/** Per-slug fallback notes for models with no verified benchmarks (single source: data/meta/benchmarks.json). */
export function getEmptyBenchmarkNotes(): Record<string, string> {
  return getBenchmarksMeta().emptyBenchmarkNotes ?? {};
}

/**
 * Human label for the snapshot window across all arena boards,
 * e.g. "Aug 6–15, 2026" (same month) or "Jul 30 – Aug 15, 2026".
 */
export function getSnapshotRangeLabel(): string {
  const meta = getBenchmarksMeta();
  const dates = ARENA_CATEGORY_ORDER.map((cat) => new Date(`${meta.categories[cat].snapshotAt}T00:00:00Z`));
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (min.getUTCFullYear() === max.getUTCFullYear() && min.getUTCMonth() === max.getUTCMonth()) {
    return `${month(min)} ${min.getUTCDate()}–${max.getUTCDate()}, ${max.getUTCFullYear()}`;
  }
  return `${month(min)} ${min.getUTCDate()} – ${month(max)} ${max.getUTCDate()}, ${max.getUTCFullYear()}`;
}
