import { z } from "zod";

/**
 * Shared types for the AI content detector — the API contract between
 * src/app/api/detect/route.ts and src/components/ai-detector.tsx.
 */

export const DETECTION_KINDS = ["text", "code", "image"] as const;
export type DetectionKind = (typeof DETECTION_KINDS)[number];

export const DETECTION_STATUSES = [
  "confident_ai",
  "likely_ai",
  "insufficient_data",
  "likely_human",
  "confident_human",
  "provenance_signed",
] as const;
export type DetectionStatus = (typeof DETECTION_STATUSES)[number];

/** Hard transport limits. Semantic gates (min words/lines) live in data/detector/thresholds.json. */
export const LIMITS = {
  textMaxChars: 400_000, // generous ceiling; the 20K-word gate is enforced by thresholds
  codeMaxChars: 50_000,
  imageMaxBytes: 8 * 1024 * 1024,
  /** base64 inflates by ~4/3 */
  imageMaxBase64Length: Math.ceil((8 * 1024 * 1024 * 4) / 3) + 1024,
} as const;

export const detectRequestSchema = z
  .object({
    kind: z.enum(DETECTION_KINDS),
    text: z.string().max(LIMITS.textMaxChars).optional(),
    imageBase64: z
      .string()
      .max(LIMITS.imageMaxBase64Length)
      .regex(/^[A-Za-z0-9+/=\r\n]+$/, "imageBase64 must be valid base64")
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "image") {
      if (!value.imageBase64) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "imageBase64 is required for kind=image" });
      }
      if (value.text) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "text is not allowed for kind=image" });
      }
      return;
    }
    if (!value.text || value.text.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "text is required for kind=text/code" });
    }
    if (value.imageBase64) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "imageBase64 is only allowed for kind=image" });
    }
    if (value.kind === "code" && value.text && value.text.length > LIMITS.codeMaxChars) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `code input is limited to ${LIMITS.codeMaxChars} characters`,
      });
    }
  });

export type DetectRequest = z.infer<typeof detectRequestSchema>;

/** Per-span score: char offsets into the submitted text, score in [0,1] (1 = looks AI). */
export interface SpanScore {
  start: number;
  end: number;
  score: number;
}

export type LayerState = "ok" | "unavailable" | "error" | "skipped";

export interface LayerReport {
  state: LayerState;
  /** Human-readable detail, e.g. why the layer is unavailable. Never contains secrets. */
  detail?: string;
}

export interface AttributionEntry {
  family: string;
  label: string;
  probability: number;
}

export interface DetectionResponse {
  status: DetectionStatus;
  /** Calibrated probability of "AI-generated", null when no layer produced a score. */
  probability: number | null;
  /** Bootstrap confidence interval for probability, null when not computable. */
  ci: [number, number] | null;
  attribution: AttributionEntry[] | null;
  spans: SpanScore[];
  layers: {
    provenance: LayerReport;
    zeroshot: LayerReport;
    attribution: LayerReport;
    external: LayerReport;
  };
  /** Short explanations of gates/decisions, safe to show in the UI. */
  notes: string[];
  disclaimer: string;
  /** Echo of measured input size, for UI context. */
  input: { kind: DetectionKind; words?: number; lines?: number; bytes?: number };
}
