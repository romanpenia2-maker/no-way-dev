import fs from "node:fs";
import path from "node:path";
import { modelSchema, type Model } from "@data/schemas/model.schema";

const modelsDir = path.join(process.cwd(), "data", "models");

let cache: Model[] | null = null;

export function getAllModels(): Model[] {
  if (cache) return cache;
  cache = fs
    .readdirSync(modelsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => modelSchema.parse(JSON.parse(fs.readFileSync(path.join(modelsDir, f), "utf8"))));
  return cache;
}

export function getModel(slug: string): Model | undefined {
  return getAllModels().find((m) => m.slug === slug);
}

/** One row per model × provider pricing entry. */
export interface PriceRow {
  modelSlug: string;
  modelName: string;
  modelProvider: string;
  pricingProvider: string;
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
  contextTokens: number;
  capabilities: Model["capabilities"];
  status: Model["status"];
  openWeights: boolean;
  updatedAt: string;
  sourceUrl: string;
  /** Pricing-entry note (e.g. off-peak caveats), if present in the data. */
  note?: string;
}

export function getAllPriceRows(): PriceRow[] {
  return getAllModels().flatMap((m) =>
    m.pricing.map((p) => ({
      modelSlug: m.slug,
      modelName: m.name,
      modelProvider: m.provider,
      pricingProvider: p.provider,
      inputPer1M: p.inputPer1M,
      outputPer1M: p.outputPer1M,
      cachedInputPer1M: p.cachedInputPer1M,
      contextTokens: m.context.tokens,
      capabilities: m.capabilities,
      status: m.status,
      openWeights: m.openWeights,
      updatedAt: p.updatedAt,
      sourceUrl: p.sourceUrl,
      note: p.note,
    })),
  );
}

/** Cheapest rows by combined input+output price, for hero / listings. */
export function getCheapestPriceRows(limit: number): PriceRow[] {
  return [...getAllPriceRows()]
    .sort((a, b) => a.inputPer1M + a.outputPer1M - (b.inputPer1M + b.outputPer1M))
    .slice(0, limit);
}
