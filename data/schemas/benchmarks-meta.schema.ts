import { z } from "zod";

export const arenaCategoryMetaSchema = z.object({
  label: z.string().min(1),
  snapshotAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "snapshotAt must be YYYY-MM-DD"),
  votes: z.number().int().positive(),
  totalModels: z.number().int().positive(),
  sourceUrl: z.string().url(),
});

export const benchmarksMetaSchema = z.object({
  categories: z.object({
    text: arenaCategoryMetaSchema,
    webdev: arenaCategoryMetaSchema,
    vision: arenaCategoryMetaSchema,
    coding: arenaCategoryMetaSchema,
    "hard-prompts": arenaCategoryMetaSchema,
    math: arenaCategoryMetaSchema,
  }),
  /** What to show instead of an empty benchmark list, keyed by model slug. */
  emptyBenchmarkNotes: z.record(z.string().min(1)).optional(),
  /** "Caveats †" footnotes on /benchmarks — per-model measurement warnings. */
  caveats: z.array(z.string().min(1)),
  /** "Off the boards" list: {slug, text} rendered as "Model name text". */
  offTheBoards: z.array(
    z.object({
      slug: z.string().min(1),
      text: z.string().min(1),
    }),
  ),
});

export type ArenaCategoryMeta = z.infer<typeof arenaCategoryMetaSchema>;
export type BenchmarksMeta = z.infer<typeof benchmarksMetaSchema>;
