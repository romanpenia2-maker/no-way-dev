/**
 * L4 — external second-opinion detectors (optional, key-gated).
 *
 * - Images: Sightengine `genai` model (free tier ~2000 ops/month).
 * - Text:   Sapling AI detector (metered) — called only for borderline cases.
 *
 * Both fail closed: any HTTP/quota problem becomes state:"error" and the
 * verdict is built without the layer. Keys never leave the server.
 */

export type ExternalOutcome =
  | { state: "ok"; provider: "sightengine" | "sapling"; probability: number }
  | { state: "unavailable"; detail: string }
  | { state: "error"; detail: string };

const TIMEOUT_MS = 20_000;

export async function runSightengine(image: Buffer, mime: string): Promise<ExternalOutcome> {
  const user = process.env.SIGHTENGINE_API_USER;
  const secret = process.env.SIGHTENGINE_API_SECRET;
  if (!user || !secret) {
    return { state: "unavailable", detail: "SIGHTENGINE_API_USER/SECRET not configured." };
  }
  try {
    const form = new FormData();
    form.set("models", "genai");
    form.set("api_user", user);
    form.set("api_secret", secret);
    form.set("media", new Blob([new Uint8Array(image)], { type: mime }), "upload");

    const res = await fetch("https://api.sightengine.com/1.0/check.json", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as {
      status?: string;
      type?: { ai_generated?: number };
      error?: { message?: string };
    } | null;
    if (!res.ok || !json || json.status !== "success" || typeof json.type?.ai_generated !== "number") {
      const detail = json?.error?.message ?? `HTTP ${res.status}`;
      return { state: "error", detail: `Sightengine: ${detail.slice(0, 200)}` };
    }
    return { state: "ok", provider: "sightengine", probability: json.type.ai_generated };
  } catch (e) {
    return { state: "error", detail: `Sightengine: ${(e as Error).message.slice(0, 200)}` };
  }
}

export async function runSapling(text: string): Promise<ExternalOutcome> {
  const key = process.env.SAPLING_API_KEY;
  if (!key) {
    return { state: "unavailable", detail: "SAPLING_API_KEY not configured." };
  }
  try {
    const res = await fetch("https://api.sapling.ai/api/v1/aidetect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { score?: number; msg?: string } | null;
    if (!res.ok || !json || typeof json.score !== "number") {
      const detail = json?.msg ?? `HTTP ${res.status}`;
      return { state: "error", detail: `Sapling: ${detail.slice(0, 200)}` };
    }
    return { state: "ok", provider: "sapling", probability: json.score };
  } catch (e) {
    return { state: "error", detail: `Sapling: ${(e as Error).message.slice(0, 200)}` };
  }
}
