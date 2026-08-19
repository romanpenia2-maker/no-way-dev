import fs from "node:fs";
import path from "node:path";
import { benchmarksMetaSchema, type BenchmarksMeta } from "@data/schemas/benchmarks-meta.schema";
import type { BenchmarkEntry, Model } from "@data/schemas/model.schema";
import { getAllModels } from "@/lib/data/models";

const metaFile = path.join(process.cwd(), "data", "meta", "benchmarks.json");

let metaCache: BenchmarksMeta | null = null;

export function getBenchmarksMeta(): BenchmarksMeta {
  if (metaCache) return metaCache;
  metaCache = benchmarksMetaSchema.parse(JSON.parse(fs.readFileSync(metaFile, "utf8")));
  return metaCache;
}

export interface BenchmarkValue {
  score: number;
  note?: string;
}

/** One row per model on the /benchmarks leaderboard. */
export interface LeaderboardRow {
  modelSlug: string;
  modelName: string;
  modelProvider: string;
  openWeights: boolean;
  elo: number;
  rank: number;
  arenaVariant?: string;
  arenaNote?: string;
  sweBench?: BenchmarkValue;
  gpqa?: BenchmarkValue;
  aime?: BenchmarkValue;
  liveCodeBench?: BenchmarkValue;
  mmmu?: BenchmarkValue;
  hle?: BenchmarkValue;
}

function findBenchmark(benchmarks: BenchmarkEntry[] | undefined, prefix: string): BenchmarkValue | undefined {
  const hit = benchmarks?.find((b) => b.name.startsWith(prefix));
  return hit ? { score: hit.score, note: hit.note } : undefined;
}

function toRow(m: Model): LeaderboardRow | null {
  if (!m.arena) return null;
  return {
    modelSlug: m.slug,
    modelName: m.name,
    modelProvider: m.provider,
    openWeights: m.openWeights,
    elo: m.arena.elo,
    rank: m.arena.rank,
    arenaVariant: m.arena.variant,
    arenaNote: m.arena.note,
    sweBench: findBenchmark(m.benchmarks, "SWE-bench"),
    gpqa: findBenchmark(m.benchmarks, "GPQA"),
    aime: findBenchmark(m.benchmarks, "AIME"),
    liveCodeBench: findBenchmark(m.benchmarks, "LiveCodeBench"),
    mmmu: findBenchmark(m.benchmarks, "MMMU"),
    hle: findBenchmark(m.benchmarks, "Humanity's Last Exam"),
  };
}

export function getLeaderboardRows(): LeaderboardRow[] {
  return getAllModels()
    .map(toRow)
    .filter((r): r is LeaderboardRow => r !== null)
    .sort((a, b) => b.elo - a.elo);
}

/** Count of unique benchmark names tracked across all models. */
export function getUniqueBenchmarkCount(): number {
  return new Set(getAllModels().flatMap((m) => (m.benchmarks ?? []).map((b) => b.name))).size;
}
