"use client";

/**
 * Client-side C2PA provenance check (L0).
 *
 * Uses @contentauth/c2pa-web (WASM) loaded via dynamic import — the ~11 MB
 * inline-WASM chunk is fetched ONLY when the user actually picks an image, so
 * it never lands in the initial page bundle. Everything runs in the browser:
 * the file is not uploaded for this step.
 *
 * Outcomes:
 *  - valid signature + AI claim generator / trainedAlgorithmicMedia action
 *      → "signed_ai" (verdict provenance_signed, API is not called)
 *  - valid signature, no AI indication (e.g. a camera-signed photo)
 *      → "signed_other" (cryptographically signed, but not an AI claim)
 *  - manifest present but INVALID signature → "invalid" (worth reporting!)
 *  - no manifest / unsupported / library failed → "none" / "unavailable"
 */

export type C2paOutcome =
  | { kind: "signed_ai"; generator: string | null; validationState: string }
  | { kind: "signed_other"; generator: string | null; validationState: string }
  | { kind: "invalid"; detail: string }
  | { kind: "none" }
  | { kind: "unavailable"; detail: string };

const AI_GENERATOR_RE =
  /dall-?e|firefly|midjourney|stable.?diffusion|comfyui|automatic1111|novelai|invokeai|leonardo|ideogram|flux|recraft|imagen|gemini|copilot|bing image|adobe.*ai|getty.*ai|shutterstock.*ai/i;

const AI_SOURCE_TYPES = [
  "trainedAlgorithmicMedia",
  "compositeWithTrainedAlgorithmicMedia",
  "algorithmicMedia",
];

interface ManifestLike {
  claim_generator?: string | null;
  claim_generator_info?: { name?: string }[] | null;
  assertions?: { label?: string; data?: unknown }[] | null;
  [k: string]: unknown;
}

function manifestIsAi(manifest: ManifestLike | undefined): boolean {
  if (!manifest) return false;
  const generator = [manifest.claim_generator, ...(manifest.claim_generator_info ?? []).map((g) => g?.name)]
    .filter(Boolean)
    .join(" ");
  if (generator && AI_GENERATOR_RE.test(generator)) return true;
  // c2pa.actions assertion: look for digitalSourceType values
  const serialized = JSON.stringify(manifest.assertions ?? []);
  return AI_SOURCE_TYPES.some((t) => serialized.includes(t));
}

export async function checkC2pa(file: File): Promise<C2paOutcome> {
  try {
    const { createC2pa } = await import("@contentauth/c2pa-web/inline");
    const c2pa = await createC2pa();
    const reader = await c2pa.reader.fromBlob(file.type, file);
    if (!reader) return { kind: "none" };
    try {
      const store = await reader.manifestStore();
      if (!store) return { kind: "none" };
      const state = String(store.validation_state ?? "Unknown");
      const activeLabel = store.active_manifest ?? undefined;
      const manifest = (activeLabel ? store.manifests?.[activeLabel] : undefined) as
        | ManifestLike
        | undefined;
      const generator =
        manifest?.claim_generator ??
        manifest?.claim_generator_info?.[0]?.name ??
        null;

      if (state === "Invalid") {
        return {
          kind: "invalid",
          detail: "A C2PA manifest is present but its signature is INVALID — the file or metadata was modified after signing.",
        };
      }
      if (manifestIsAi(manifest)) {
        return { kind: "signed_ai", generator, validationState: state };
      }
      return { kind: "signed_other", generator, validationState: state };
    } finally {
      await reader.free().catch(() => undefined);
    }
  } catch (e) {
    const message = (e as Error).message ?? "unknown error";
    // "No provenance" is a normal outcome, not a failure of the checker.
    if (/no (c2pa|jumbf|manifest)|not found|unsupported/i.test(message)) return { kind: "none" };
    return { kind: "unavailable", detail: message.slice(0, 200) };
  }
}
