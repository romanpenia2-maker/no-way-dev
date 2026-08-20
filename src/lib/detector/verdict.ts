import type { DetectorThresholds } from "@data/schemas/detector.schema";
import { clamp01 } from "./spans";
import type { DetectionStatus } from "./types";

/**
 * Verdict logic — pure functions, unit-testable without any network.
 *
 * Zone model (two calibrated thresholds per modality):
 *   p >= tauFpr1        → confident_ai
 *   tauFpr5 <= p < tauFpr1 → likely_ai
 *   p <= 1 - tauFpr1    → confident_human
 *   1 - tauFpr1 < p <= 1 - tauFpr5 → likely_human
 *   otherwise           → abstention band → "insufficient_data"
 *
 * The abstention band is deliberate (cross-verification: OOD degradation makes
 * mid-range scores meaningless). The UI labels it honestly instead of picking
 * a side.
 */

export function statusFromProbability(
  probability: number,
  zone: { tauFpr1: number; tauFpr5: number },
): DetectionStatus {
  if (probability >= zone.tauFpr1) return "confident_ai";
  if (probability >= zone.tauFpr5) return "likely_ai";
  if (probability <= 1 - zone.tauFpr1) return "confident_human";
  if (probability <= 1 - zone.tauFpr5) return "likely_human";
  return "insufficient_data";
}

/** In the abstention band? Used to decide whether to pay for an external second opinion. */
export function isBorderline(probability: number, zone: { tauFpr1: number; tauFpr5: number }): boolean {
  return probability > 1 - zone.tauFpr5 && probability < zone.tauFpr1;
}

/**
 * Combine the zero-shot score with an external second opinion.
 * Equal-weight mean for the point estimate; CI becomes the union of the two
 * intervals (honest widening — the two signals may disagree).
 */
export function combineProbabilities(
  a: { probability: number; ci: [number, number] | null },
  b: { probability: number },
): { probability: number; ci: [number, number] | null } {
  const probability = clamp01((a.probability + b.probability) / 2);
  if (!a.ci) return { probability, ci: null };
  const lo = Math.min(a.ci[0], b.probability);
  const hi = Math.max(a.ci[1], b.probability);
  return { probability, ci: [clamp01(lo), clamp01(hi)] };
}

/** Crude English check for the attribution gate: ≥80% of letters are ASCII. */
export function isProbablyEnglish(text: string): boolean {
  const letters = text.match(/[a-zA-ZÀ-ɏḀ-ỿЀ-ӿ]/g);
  if (!letters || letters.length < 50) return true; // too few letters to judge — do not block
  const ascii = letters.filter((c) => c.charCodeAt(0) < 128).length;
  return ascii / letters.length >= 0.8;
}

/** Probability assigned by strong generator-metadata hints (documented heuristic, not ML). */
export const PROVENANCE_STRONG_AI_PROBABILITY = 0.97;

export function zoneForKind(thresholds: DetectorThresholds, kind: "text" | "code" | "image") {
  return thresholds[kind === "image" ? "image" : kind];
}
