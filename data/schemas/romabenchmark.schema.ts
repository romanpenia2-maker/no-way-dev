import { z } from "zod";

/** pass = correct, fail = wrong answer, na = not run (e.g. channel outage). */
const checkSchema = z.enum(["pass", "fail", "na"]);

const roundSchema = z.object({
  /** Stable id referenced by model checks, e.g. "r1", "t3". */
  id: z.string().min(1),
  /** Short column label, e.g. "R1". */
  label: z.string().min(1),
  task: z.string().min(1),
  /** Ground-truth answer, script-verified. */
  answer: z.string().min(1),
});

const perfSchema = z.object({
  ms: z.number().int().positive(),
  tokens: z.number().int().positive(),
});

const modelResultSchema = z.object({
  name: z.string().min(1),
  /** Per-round outcomes keyed by round id. */
  checks: z.record(checkSchema),
  /** Human-readable note for failed cells, keyed by round id. */
  failNotes: z.record(z.string().min(1)).optional(),
  /** Round 3 (math gauntlet) and round 4 (coding) timing/usage. */
  r3: perfSchema.optional(),
  r4: perfSchema.optional(),
  /** Overall score string, e.g. "8/8". */
  score: z.string().min(1),
  verdict: z.string().min(1),
});

export const romabenchmarkSchema = z.object({
  /** Date the benchmark was run, YYYY-MM-DD. */
  runAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "runAt must be YYYY-MM-DD"),
  gateway: z.object({
    name: z.string().min(1),
    baseUrl: z.string().url(),
  }),
  methodology: z.array(z.string().min(1)).min(1),
  rounds: z.array(roundSchema).min(1),
  models: z.array(modelResultSchema).min(1),
  /** Gateway/channel incidents observed during the run. */
  incidents: z.array(z.string().min(1)).optional(),
});

export type RomaBenchmark = z.infer<typeof romabenchmarkSchema>;
export type RomaCheck = z.infer<typeof checkSchema>;
