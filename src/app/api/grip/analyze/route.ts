import { NextResponse } from "next/server";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/grip/analyze — read the number off a hand-dynamometer photo with a
 * VLM (DeepInfra, OpenAI-compatible chat API). Honest degradation: no key →
 * { state: "unavailable" }; provider failure → { state: "error" }. Never
 * fabricates a reading.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 20 analyses/hour/IP, per warm instance (same pattern as /api/detect).
const limiter = createRateLimiter({ windowMs: 60 * 60 * 1000, maxRequests: 20 });

const DEEPINFRA_URL = "https://api.deepinfra.com/v1/openai/chat/completions";
const PRIMARY_MODEL = "Qwen/Qwen3-VL-235B-A22B-Instruct";
// Verified against GET /v1/openai/models: Qwen2-VL-72B is not listed, the
// listed fallback is the 30B Qwen3-VL.
const FALLBACK_MODEL = "Qwen/Qwen3-VL-30B-A3B-Instruct";
const REQUEST_TIMEOUT_MS = 45_000;
/** data URL length cap — client resizes to ≤1280px / ≤400KB JPEG (~550KB b64). */
const MAX_IMAGE_CHARS = 800_000;

const PROMPT =
  "Is there a person holding a hand dynamometer (grip strength meter) in this photo? " +
  "If yes, read the number on its display. Reply ONLY JSON: " +
  '{"hasPerson":bool,"hasDynamometer":bool,"kg":number|null,"confidence":"high|low"}';

interface Analysis {
  hasPerson: boolean;
  hasDynamometer: boolean;
  kg: number | null;
  confidence: "high" | "low";
}

function json(body: unknown, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers });
}

/** Tolerate ```json fences and surrounding prose; extract the first {...}. */
function parseAnalysis(content: string): Analysis | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const kg =
      typeof raw.kg === "number" && Number.isFinite(raw.kg) ? Math.round(raw.kg * 10) / 10 : null;
    return {
      hasPerson: raw.hasPerson === true,
      hasDynamometer: raw.hasDynamometer === true,
      kg,
      confidence: raw.confidence === "high" ? "high" : "low",
    };
  } catch {
    return null;
  }
}

async function callVlm(apiKey: string, model: string, imageDataUrl: string): Promise<Response> {
  return fetch(DEEPINFRA_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 150,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function POST(request: Request) {
  const rl = limiter.check(clientIp(request));
  if (!rl.allowed) {
    return json(
      { state: "error", detail: "Too many analyses. Try again later." },
      429,
      { "retry-after": String(rl.retryAfterSeconds) },
    );
  }

  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) {
    return json({ state: "unavailable", detail: "AI photo analysis is not configured." }, 200);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ state: "error", detail: "Request body must be JSON." }, 400);
  }
  const imageBase64 = (body as Record<string, unknown>)?.imageBase64;
  if (
    typeof imageBase64 !== "string" ||
    !imageBase64.startsWith("data:image/") ||
    imageBase64.length > MAX_IMAGE_CHARS
  ) {
    return json({ state: "error", detail: "imageBase64 must be an image data URL under 800KB." }, 400);
  }

  try {
    let res = await callVlm(apiKey, PRIMARY_MODEL, imageBase64);
    if (res.status === 404) {
      res = await callVlm(apiKey, FALLBACK_MODEL, imageBase64);
    }
    if (!res.ok) {
      return json({ state: "error", detail: `Vision provider returned HTTP ${res.status}.` }, 502);
    }
    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const analysis = parseAnalysis(content);
    if (!analysis) {
      return json({ state: "error", detail: "Could not parse the vision model reply." }, 502);
    }
    return json(analysis, 200);
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return json(
      { state: "error", detail: timedOut ? "Vision provider timed out." : "Vision provider request failed." },
      502,
    );
  }
}
