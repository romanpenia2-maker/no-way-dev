import { NextResponse } from "next/server";
import { runAttribution } from "@/lib/detector/attribute";
import { getAttributionConfig, getDetectorCopy, getDetectorThresholds } from "@/lib/detector/config";
import { runSapling, runSightengine } from "@/lib/detector/external";
import { analyzeImageProvenance } from "@/lib/detector/provenance";
import { checkRateLimit } from "@/lib/detector/rate-limit";
import { countNonEmptyLines, countWords } from "@/lib/detector/spans";
import {
  detectRequestSchema,
  type DetectionResponse,
  type LayerReport,
} from "@/lib/detector/types";
import {
  combineProbabilities,
  isBorderline,
  isProbablyEnglish,
  PROVENANCE_STRONG_AI_PROBABILITY,
  statusFromProbability,
} from "@/lib/detector/verdict";
import { runZeroshot } from "@/lib/detector/zeroshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function json(body: unknown, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers });
}

const unavailable = (detail: string): LayerReport => ({ state: "unavailable", detail });
const skipped = (detail: string): LayerReport => ({ state: "skipped", detail });

export async function POST(request: Request) {
  const thresholds = getDetectorThresholds();
  const copy = getDetectorCopy();

  // --- rate limit (best-effort, per warm instance) --------------------------
  const rl = checkRateLimit(clientIp(request));
  if (!rl.allowed) {
    return json(
      { error: "rate_limited", message: "Too many checks. Try again later." },
      429,
      { "retry-after": String(rl.retryAfterSeconds) },
    );
  }

  // --- input validation ------------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request", message: "Request body must be JSON." }, 400);
  }
  const parsed = detectRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      400,
    );
  }
  const input = parsed.data;

  const base: DetectionResponse = {
    status: "insufficient_data",
    probability: null,
    ci: null,
    attribution: null,
    spans: [],
    layers: {
      provenance: skipped("not applicable to this input type"),
      zeroshot: skipped("not applicable to this input type"),
      attribution: skipped("not applicable to this input type"),
      external: skipped("not applicable to this input type"),
    },
    notes: [],
    disclaimer: copy.disclaimer,
    input: { kind: input.kind },
  };

  // --- image path ------------------------------------------------------------
  if (input.kind === "image") {
    const buf = Buffer.from(input.imageBase64 as string, "base64");
    base.input.bytes = buf.length;
    if (buf.length === 0 || buf.length > thresholds.image.maxBytes) {
      return json({ error: "bad_request", message: "Image is empty or exceeds the 8 MB limit." }, 400);
    }

    const provenance = analyzeImageProvenance(buf);
    base.layers.provenance = {
      state: "ok",
      detail: `format=${provenance.format}; signals=${provenance.signals.length}`,
    };
    if (provenance.c2paManifestPresent) {
      base.notes.push(
        "A C2PA manifest is embedded in this file. Its signature is verified in your browser before upload; presence alone does not prove AI origin (cameras sign photos too).",
      );
    }
    const strongAi = provenance.signals.filter((s) => s.direction === "ai" && s.weight === "strong");
    for (const s of provenance.signals) base.notes.push(s.detail);

    // Sightengine: always called for images when configured (architecture L4).
    const mime = provenance.format === "png" ? "image/png" : provenance.format === "jpeg" ? "image/jpeg" : "application/octet-stream";
    const external = await runSightengine(buf, mime);
    base.layers.external =
      external.state === "ok"
        ? { state: "ok", detail: `Sightengine genai: ${(external.probability * 100).toFixed(1)}% AI` }
        : { state: external.state, detail: external.detail };

    let probability: number | null = null;
    if (strongAi.length > 0 && external.state === "ok") {
      probability = (PROVENANCE_STRONG_AI_PROBABILITY + external.probability) / 2;
    } else if (strongAi.length > 0) {
      probability = PROVENANCE_STRONG_AI_PROBABILITY;
    } else if (external.state === "ok") {
      probability = external.probability;
    }
    if (probability === null) {
      base.status = "insufficient_data";
      base.notes.push(
        "No provenance signals found and the external image detector is not configured. Nothing reliable to report — metadata is easily stripped, so absence of hints is not evidence of human origin.",
      );
    } else {
      base.probability = probability;
      base.ci = [Math.max(0, probability - 0.1), Math.min(1, probability + 0.1)];
      base.status = statusFromProbability(probability, thresholds.image);
    }
    return json(base, 200);
  }

  // --- text / code path -------------------------------------------------------
  const text = input.text as string;
  const words = countWords(text);
  const lines = input.kind === "code" ? countNonEmptyLines(text) : 0;
  base.input.words = words;
  if (input.kind === "code") base.input.lines = lines;

  // Length gates (cross-verification: below these, every known method is noise).
  if (input.kind === "text" && words > thresholds.text.maxWords) {
    return json(
      { error: "bad_request", message: `Text is limited to ${thresholds.text.maxWords} words.` },
      400,
    );
  }
  if (input.kind === "text" && words < thresholds.text.minWords) {
    base.status = "insufficient_data";
    base.notes.push(
      `Only ${words} words — at least ${thresholds.text.minWords} are required for a reliable signal. Short texts are refused on purpose: every known detector is unreliable on them.`,
    );
    base.layers.zeroshot = skipped("below minimum length gate");
    return json(base, 200);
  }
  if (input.kind === "code" && lines < thresholds.code.minLines) {
    base.status = "insufficient_data";
    base.notes.push(
      `Only ${lines} non-empty lines — at least ${thresholds.code.minLines} are required for a reliable signal.`,
    );
    base.layers.zeroshot = skipped("below minimum length gate");
    return json(base, 200);
  }

  const zeroshot = await runZeroshot(text, input.kind, thresholds);
  if (zeroshot.state === "ok") {
    base.layers.zeroshot = {
      state: "ok",
      detail: `${zeroshot.provider} echo-logprobs, ${zeroshot.tokensScored} tokens scored${zeroshot.truncated ? " (input truncated to the first 24K chars)" : ""}`,
    };
    base.probability = zeroshot.probability;
    base.ci = zeroshot.ci;
    base.spans = zeroshot.spans;
  } else {
    base.layers.zeroshot = { state: zeroshot.state, detail: zeroshot.detail };
  }

  // Sapling second opinion: only when configured AND (zero-shot missing or borderline).
  const zone = thresholds[input.kind];
  const borderline = base.probability !== null && isBorderline(base.probability, zone);
  if (input.kind === "text" && process.env.SAPLING_API_KEY && (base.probability === null || borderline)) {
    const external = await runSapling(text.slice(0, 50_000));
    if (external.state === "ok") {
      base.layers.external = {
        state: "ok",
        detail: `Sapling: ${(external.probability * 100).toFixed(1)}% AI`,
      };
      if (base.probability === null) {
        base.probability = external.probability;
      } else {
        const combined = combineProbabilities(
          { probability: base.probability, ci: base.ci },
          { probability: external.probability },
        );
        base.probability = combined.probability;
        base.ci = combined.ci;
      }
      base.notes.push("Borderline score — an external second opinion (Sapling) was included.");
    } else {
      base.layers.external = { state: external.state, detail: external.detail };
    }
  } else {
    base.layers.external = process.env.SAPLING_API_KEY
      ? skipped("score already conclusive")
      : unavailable("SAPLING_API_KEY not configured.");
    if (input.kind === "code") {
      base.layers.external = skipped("no reliable external detector for code exists");
    }
  }

  if (base.probability !== null) {
    base.status = statusFromProbability(base.probability, zone);
    if (base.status === "insufficient_data") {
      base.notes.push(
        "The score falls in the abstention band — detectors degrade sharply on out-of-distribution content, so we refuse to pick a side here.",
      );
    }
  } else {
    base.status = "insufficient_data";
    base.notes.push(
      "No detection layer produced a score (ML provider keys are not configured on this deployment).",
    );
  }

  // Attribution gate: enough words, English-only, provider configured.
  const attrMin = input.kind === "code" ? thresholds.code.attributionMinWords : thresholds.text.attributionMinWords;
  if (words >= attrMin && isProbablyEnglish(text) && process.env.DEEPINFRA_API_KEY) {
    const attribution = await runAttribution(text, getAttributionConfig(), thresholds);
    if (attribution.state === "ok") {
      base.attribution = attribution.attribution;
      base.layers.attribution = { state: "ok", detail: "experimental — model family granularity" };
    } else {
      base.layers.attribution = { state: attribution.state, detail: attribution.detail };
    }
  } else {
    base.layers.attribution = skipped(
      words < attrMin
        ? `needs at least ${attrMin} words`
        : !isProbablyEnglish(text)
          ? "attribution is English-only in the MVP"
          : "no LLM provider key configured",
    );
  }

  return json(base, 200);
}
