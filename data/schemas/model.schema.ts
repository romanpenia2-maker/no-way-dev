import { z } from "zod";

export const capabilitySchema = z.enum([
  "text",
  "vision",
  "audio",
  "tools",
  "json-mode",
  "reasoning",
]);

export const modelStatusSchema = z.enum(["ga", "beta", "deprecated"]);

export const pricingEntrySchema = z.object({
  provider: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "provider must be a kebab-case slug"),
  inputPer1M: z.number().nonnegative(),
  outputPer1M: z.number().nonnegative(),
  cachedInputPer1M: z.number().nonnegative().optional(),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "updatedAt must be YYYY-MM-DD"),
  sourceUrl: z.string().url(),
});

export const benchmarkEntrySchema = z.object({
  name: z.string().min(1),
  score: z.number().nonnegative(),
  note: z.string().min(1).optional(),
  testedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "testedAt must be YYYY-MM-DD"),
  sourceUrl: z.string().url(),
});

export const arenaSchema = z.object({
  elo: z.number().int().positive(),
  rank: z.number().int().positive(),
  variant: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  snapshotAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "snapshotAt must be YYYY-MM-DD"),
});

export const modelSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/, "slug must be kebab-case (dots allowed)"),
  name: z.string().min(1),
  provider: z.string().min(1),
  releasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "releasedAt must be YYYY-MM-DD"),
  status: modelStatusSchema,
  context: z.object({
    tokens: z.number().int().positive(),
    maxOutput: z.number().int().positive().optional(),
  }),
  pricing: z.array(pricingEntrySchema).min(1, "at least one pricing entry is required"),
  capabilities: z.array(capabilitySchema).min(1),
  openWeights: z.boolean(),
  license: z.string().min(1).optional(),
  lastVerifiedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "lastVerifiedAt must be YYYY-MM-DD"),
  arena: arenaSchema.optional(),
  benchmarks: z.array(benchmarkEntrySchema).optional(),
});

export type Capability = z.infer<typeof capabilitySchema>;
export type ModelStatus = z.infer<typeof modelStatusSchema>;
export type PricingEntry = z.infer<typeof pricingEntrySchema>;
export type BenchmarkEntry = z.infer<typeof benchmarkEntrySchema>;
export type ArenaEntry = z.infer<typeof arenaSchema>;
export type Model = z.infer<typeof modelSchema>;
