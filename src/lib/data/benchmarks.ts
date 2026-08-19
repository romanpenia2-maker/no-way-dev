import fs from "node:fs";
import path from "node:path";
import { benchmarksMetaSchema, type BenchmarksMeta } from "@data/schemas/benchmarks-meta.schema";
import type { ArenaCategory, BenchmarkEntry, Model } from "@data/schemas/model.schema";
import { getAllModels } from "@/lib/data/models";
import { getProviderName } from "@/lib/data/providers";
import {
  ARENA_CATEGORY_ORDER,
  type BenchmarkValue,
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

function findBenchmark(benchmarks: BenchmarkEntry[] | undefined, prefix: string): BenchmarkValue | undefined {
  const hit = benchmarks?.find((b) => b.name.startsWith(prefix));
  return hit ? { score: hit.score, note: hit.note } : undefined;
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
    sweBenchPro: findBenchmark(m.benchmarks, "SWE-bench Pro"),
    terminalBench: findBenchmark(m.benchmarks, "Terminal-Bench"),
    gpqa: findBenchmark(m.benchmarks, "GPQA"),
    hle: findBenchmark(m.benchmarks, "Humanity's Last Exam"),
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

/** Count of unique benchmark names tracked across all models. */
export function getUniqueBenchmarkCount(): number {
  return new Set(getAllModels().flatMap((m) => (m.benchmarks ?? []).map((b) => b.name))).size;
}
