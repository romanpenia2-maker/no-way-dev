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
  // --- UX overhaul keys (detector-ux-map §3/§4) ------------------------------
  /** Primary "what this means" sentence per verdict status. */
  interpretationByStatus: z.object({
    confident_ai: z.string().min(1),
    likely_ai: z.string().min(1),
    insufficient_data: z.string().min(1),
    likely_human: z.string().min(1),
    confident_human: z.string().min(1),
  }),
  /** Primary "what to do" line per verdict status (→-prefixed). */
  verdictActions: z.object({
    confident_ai: z.string().min(1),
    likely_ai: z.string().min(1),
    insufficient_data: z.string().min(1),
    likely_human: z.string().min(1),
    confident_human: z.string().min(1),
  }),
  /** Abstention: the action line is replaced by this teaching block. */
  abstainBlock: z.object({
    title: z.string().min(1),
    items: z.array(z.string().min(1)).length(3),
  }),
  /** First-visit orientation under the input; collapsed for returning visitors. */
  firstVisitHints: z.object({
    title: z.string().min(1),
    text: z.string().min(1),
    code: z.string().min(1),
    image: z.string().min(1),
    returnLink: z.string().min(1),
  }),
  /** Client-side min/max gate copy. */
  gates: z.object({
    tooShortText: z.string().min(1),
    tooShortCode: z.string().min(1),
    tooLongText: z.string().min(1),
    tooLongCode: z.string().min(1),
    shortReason: z.string().min(1),
  }),
  /** S-NO-ML: scoring layer not configured on this deployment. */
  noMl: z.object({
    badge: z.string().min(1),
    body: z.string().min(1),
    working: z.string().min(1),
    action: z.string().min(1),
  }),
  /** S-IMG-NO-SIGNALS: no metadata and no external image detector. */
  imgNoSignals: z.object({
    body: z.string().min(1),
    misread: z.string().min(1),
    hintsTitle: z.string().min(1),
    hints: z.array(z.string().min(1)).length(2),
  }),
  /** S-RATE-LIMIT card (HTTP 429 + Retry-After). */
  rateLimit: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    timer: z.string().min(1),
    timerDone: z.string().min(1),
    imageNote: z.string().min(1),
    retry: z.string().min(1),
  }),
  /** S-NETWORK-ERR card. */
  errors: z.object({
    title: z.string().min(1),
    network: z.string().min(1),
    server: z.string().min(1),
    badInput: z.string().min(1),
    badImage: z.string().min(1),
    technicalDetail: z.string().min(1),
  }),
  /** S-SPANS-INTERACTION. */
  spanHints: z.object({
    title: z.string().min(1),
    subtitle: z.string().min(1),
    legend: z.string().min(1),
    live: z.string().min(1),
    ariaLabel: z.string().min(1),
  }),
  borderlineExtNote: z.string().min(1),
  attributionEnglishNote: z.string().min(1),
  attributionFootnote: z.string().min(1),
  extOnlyNote: z.string().min(1),
  c2paInvalidNote: z.string().min(1),
  c2paNoAiNote: z.string().min(1),
  submitting: z.object({ slow: z.string().min(1) }),
  /** C2PA local-verdict and image-input strings. */
  c2pa: z.object({
    signedNoAiBadge: z.string().min(1),
    signedAiFact: z.string().min(1),
    signedNoAiFact: z.string().min(1),
    signedAiAction: z.string().min(1),
    signedNoAiAction: z.string().min(1),
    signedDisclaimer: z.string().min(1),
    invalidBadge: z.string().min(1),
    invalidFact: z.string().min(1),
    checkAnyway: z.string().min(1),
    checkAnywayNote: z.string().min(1),
    loading: z.string().min(1),
    loadingSlow: z.string().min(1),
    skip: z.string().min(1),
    tooBig: z.string().min(1),
    badFormat: z.string().min(1),
    unreadable: z.string().min(1),
    noManifest: z.string().min(1),
    unavailable: z.string().min(1),
  }),
});

export type DetectorCopy = z.infer<typeof detectorCopySchema>;
