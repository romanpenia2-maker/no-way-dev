import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

/** Two-FPR zone thresholds shared by every modality. */
const zoneSchema = z.object({
  tauFpr1: z.number().min(0.5).max(1),
  tauFpr5: z.number().min(0.5).max(1),
});

/** Sigmoid calibration from the Binoculars-style score to a probability. */
const calibrationSchema = z.object({
  scoreMidpoint: z.number().positive(),
  scoreScale: z.number().positive(),
});

export const detectorThresholdsSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: isoDate,
  note: z.string().min(1),
  sourceUrl: z.string().url(),
  text: zoneSchema
    .extend({
      minWords: z.number().int().positive(),
      maxWords: z.number().int().positive(),
      attributionMinWords: z.number().int().positive(),
    })
    .extend(calibrationSchema.shape),
  code: zoneSchema
    .extend({
      minLines: z.number().int().positive(),
      maxChars: z.number().int().positive(),
      attributionMinWords: z.number().int().positive(),
    })
    .extend(calibrationSchema.shape),
  image: zoneSchema.extend({
    maxBytes: z.number().int().positive(),
  }),
  attribution: z.object({
    minMargin: z.number().min(0).max(1),
    temperature: z.number().positive(),
    topK: z.number().int().min(1).max(5),
  }),
  bootstrap: z.object({
    resamples: z.number().int().min(20).max(1000),
    ciLevel: z.number().min(0.5).max(0.99),
  }),
});

export type DetectorThresholds = z.infer<typeof detectorThresholdsSchema>;

export const attributionConfigSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: isoDate,
  experimental: z.literal(true),
  note: z.string().min(1),
  sourceUrl: z.string().url(),
  provider: z.string().min(1),
  families: z
    .array(
      z.object({
        family: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-]+$/, "family must be a kebab-case slug"),
        label: z.string().min(1),
        proxyModel: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "proxyModel must look like org/name"),
      }),
    )
    .min(2)
    .max(8),
});

export type AttributionConfig = z.infer<typeof attributionConfigSchema>;

export const detectorCopySchema = z.object({
  version: z.number().int().positive(),
  updatedAt: isoDate,
  note: z.string().min(1),
  disclaimer: z.string().min(20),
  shortDisclaimer: z.string().min(10),
  statusLabels: z.object({
    confident_ai: z.string().min(1),
    likely_ai: z.string().min(1),
    insufficient_data: z.string().min(1),
    likely_human: z.string().min(1),
    confident_human: z.string().min(1),
    provenance_signed: z.string().min(1),
  }),
  layerLabels: z.object({
    provenance: z.string().min(1),
    zeroshot: z.string().min(1),
    attribution: z.string().min(1),
    external: z.string().min(1),
  }),
  howItWorks: z.array(z.object({ title: z.string().min(1), body: z.string().min(20) })).min(2),
  honestLimits: z.array(z.string().min(10)).min(2),
});

export type DetectorCopy = z.infer<typeof detectorCopySchema>;
