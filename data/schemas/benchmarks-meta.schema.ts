import { z } from "zod";

export const benchmarksMetaSchema = z.object({
  snapshotAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "snapshotAt must be YYYY-MM-DD"),
  votes: z.string().min(1),
  totalModels: z.number().int().positive(),
  sourceUrl: z.string().url(),
  note: z.string().min(1),
});

export type BenchmarksMeta = z.infer<typeof benchmarksMetaSchema>;
