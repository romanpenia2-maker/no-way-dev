/**
 * Validates every JSON file in /data against the zod schemas in /data/schemas.
 * Also runs cross-file checks (e.g. model.provider must exist in data/providers),
 * then HEAD-checks every sourceUrl (warnings only, unless --strict).
 *
 * Usage: npm run validate-data [-- --strict]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import { modelSchema, type Model } from "../data/schemas/model.schema";
import { providerSchema, type Provider } from "../data/schemas/provider.schema";
import { benchmarksMetaSchema } from "../data/schemas/benchmarks-meta.schema";
import { gripEntriesSchema } from "../data/schemas/grip.schema";
import {
  attributionConfigSchema,
  detectorCopySchema,
  detectorThresholdsSchema,
} from "../data/schemas/detector.schema";

const strict = process.argv.includes("--strict");

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modelsDir = path.join(root, "data", "models");
const providersDir = path.join(root, "data", "providers");
const metaDir = path.join(root, "data", "meta");
const detectorDir = path.join(root, "data", "detector");

let errors = 0;
let checked = 0;
const metaSourceUrls: string[] = [];

function fail(file: string, message: string) {
  errors += 1;
  console.error(`✗ ${file}: ${message}`);
}

function readJsonFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

// --- Providers -------------------------------------------------------------
const providers = new Map<string, Provider>();
for (const file of readJsonFiles(providersDir)) {
  const full = path.join(providersDir, file);
  checked += 1;
  try {
    const raw = JSON.parse(fs.readFileSync(full, "utf8"));
    const parsed = providerSchema.safeParse(raw);
    if (!parsed.success) {
      fail(`data/providers/${file}`, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      continue;
    }
    if (parsed.data.slug !== file.replace(/\.json$/, "")) {
      fail(`data/providers/${file}`, `slug "${parsed.data.slug}" does not match filename`);
      continue;
    }
    providers.set(parsed.data.slug, parsed.data);
  } catch (e) {
    fail(`data/providers/${file}`, `invalid JSON: ${(e as Error).message}`);
  }
}

// --- Models ----------------------------------------------------------------
const slugs = new Set<string>();
const validModels: Model[] = [];
for (const file of readJsonFiles(modelsDir)) {
  const full = path.join(modelsDir, file);
  checked += 1;
  let model: Model | null = null;
  try {
    const raw = JSON.parse(fs.readFileSync(full, "utf8"));
    const parsed = modelSchema.safeParse(raw);
    if (!parsed.success) {
      fail(`data/models/${file}`, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      continue;
    }
    model = parsed.data;
  } catch (e) {
    fail(`data/models/${file}`, `invalid JSON: ${(e as Error).message}`);
    continue;
  }
  if (model.slug !== file.replace(/\.json$/, "")) {
    fail(`data/models/${file}`, `slug "${model.slug}" does not match filename`);
  }
  if (slugs.has(model.slug)) {
    fail(`data/models/${file}`, `duplicate slug "${model.slug}"`);
  }
  slugs.add(model.slug);
  validModels.push(model);
  if (!providers.has(model.provider)) {
    fail(`data/models/${file}`, `provider "${model.provider}" has no file in data/providers/`);
  }
  for (const p of model.pricing) {
    if (!providers.has(p.provider)) {
      fail(`data/models/${file}`, `pricing provider "${p.provider}" has no file in data/providers/`);
    }
  }
}

// --- Meta (arena snapshots etc.) ---------------------------------------------
const metaSchemas: Record<string, (raw: unknown) => { success: boolean; error?: string }> = {
  "benchmarks.json": (raw) => {
    const parsed = benchmarksMetaSchema.safeParse(raw);
    return parsed.success
      ? { success: true }
      : { success: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  },
};
if (fs.existsSync(metaDir)) {
  for (const file of readJsonFiles(metaDir)) {
    const full = path.join(metaDir, file);
    checked += 1;
    const validate = metaSchemas[file];
    if (!validate) {
      fail(`data/meta/${file}`, "no schema registered for this meta file");
      continue;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(full, "utf8"));
      const result = validate(raw);
      if (!result.success) fail(`data/meta/${file}`, result.error ?? "invalid");
      if (result.success && file === "benchmarks.json") {
        metaSourceUrls.push(...Object.values(benchmarksMetaSchema.parse(raw).categories).map((c) => c.sourceUrl));
      }
    } catch (e) {
      fail(`data/meta/${file}`, `invalid JSON: ${(e as Error).message}`);
    }
  }
}

// --- Detector config ---------------------------------------------------------
// Every file in data/detector/ must have a registered schema (same rule as
// data/meta/): an unknown file is an error, a known file must parse.
const detectorSchemas: Record<string, z.ZodTypeAny> = {
  "thresholds.json": detectorThresholdsSchema,
  "attribution.json": attributionConfigSchema,
  "copy.json": detectorCopySchema,
};
if (fs.existsSync(detectorDir)) {
  const files = readJsonFiles(detectorDir);
  for (const required of Object.keys(detectorSchemas)) {
    if (!files.includes(required)) {
      fail(`data/detector/${required}`, "required detector config file is missing");
    }
  }
  for (const file of files) {
    const full = path.join(detectorDir, file);
    checked += 1;
    const schema = detectorSchemas[file];
    if (!schema) {
      fail(`data/detector/${file}`, "no schema registered for this detector file");
      continue;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(full, "utf8"));
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        fail(
          `data/detector/${file}`,
          parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        );
      }
    } catch (e) {
      fail(`data/detector/${file}`, `invalid JSON: ${(e as Error).message}`);
    }
  }
}

// --- Grip leaderboard ----------------------------------------------------------
// data/grip/entries.json is appended by /api/grip/submit at runtime; keep the
// file schema-valid and every referenced photo present in the repo.
const gripFile = path.join(root, "data", "grip", "entries.json");
if (fs.existsSync(gripFile)) {
  checked += 1;
  try {
    const raw = JSON.parse(fs.readFileSync(gripFile, "utf8"));
    const parsed = gripEntriesSchema.safeParse(raw);
    if (!parsed.success) {
      fail(
        "data/grip/entries.json",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
    } else {
      const ids = new Set<string>();
      for (const entry of parsed.data) {
        if (ids.has(entry.id)) fail("data/grip/entries.json", `duplicate id "${entry.id}"`);
        ids.add(entry.id);
        if (entry.photoPath && !fs.existsSync(path.join(root, entry.photoPath))) {
          fail("data/grip/entries.json", `photo "${entry.photoPath}" (${entry.id}) is missing from the repo`);
        }
      }
    }
  } catch (e) {
    fail("data/grip/entries.json", `invalid JSON: ${(e as Error).message}`);
  }
}

// --- Link checker ------------------------------------------------------------
// HEAD-checks every sourceUrl concurrently. Problems are warnings by default;
// pass --strict to fail on them. Known bot-blockers (403 on openai.com / x.ai)
// are allowlisted.
const BOT_BLOCK_ALLOWLIST = ["openai.com", "x.ai"];

async function checkSourceUrl(url: string): Promise<string | null> {
  let current = url;
  let redirects = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": "no-way-dev-link-checker/1.0" },
      });
    } catch (e) {
      return `request failed (${(e as Error).message})`;
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      redirects += 1;
      if (!location) return "redirect without Location header";
      if (redirects > 2) return `redirect chain too long (${redirects} redirects)`;
      current = new URL(location, current).toString();
      continue;
    }
    if (res.status === 405 || res.status === 501) {
      // Server rejects HEAD — retry once with GET.
      try {
        const get = await fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(10_000),
          headers: { "user-agent": "no-way-dev-link-checker/1.0" },
        });
        if (get.status >= 300 && get.status < 400) continue;
        if (get.status === 404 || get.status === 410) return `HTTP ${get.status}`;
        if (get.status === 403 && BOT_BLOCK_ALLOWLIST.some((h) => new URL(current).hostname.endsWith(h))) return null;
        if (get.status >= 400) return `HTTP ${get.status}`;
        return null;
      } catch (e) {
        return `request failed (${(e as Error).message})`;
      }
    }
    if (res.status === 404 || res.status === 410) return `HTTP ${res.status}`;
    if (res.status === 403 && BOT_BLOCK_ALLOWLIST.some((h) => new URL(current).hostname.endsWith(h))) return null;
    if (res.status >= 400) return `HTTP ${res.status}`;
    return null;
  }
}

const sourceUrls = new Set<string>(metaSourceUrls);
for (const p of providers.values()) {
  sourceUrls.add(p.websiteUrl).add(p.pricingUrl).add(p.apiDocsUrl);
}
for (const m of validModels) {
  for (const p of m.pricing) sourceUrls.add(p.sourceUrl);
  for (const b of m.benchmarks ?? []) sourceUrls.add(b.sourceUrl);
}

if (errors > 0) {
  console.error(`\n${errors} error(s) in ${checked} file(s). Fix before committing.`);
  process.exit(1);
}

async function runLinkCheck(): Promise<number> {
  let linkWarnings = 0;
  const linkResults = await Promise.all(
    [...sourceUrls].map(async (url) => ({ url, problem: await checkSourceUrl(url) })),
  );
  for (const { url, problem } of linkResults) {
    if (problem) {
      linkWarnings += 1;
      console.warn(`⚠ link: ${url} — ${problem}`);
    }
  }
  if (strict && linkWarnings > 0) {
    console.error(`\n✗ --strict: ${linkWarnings} source URL(s) failed the link check.`);
    process.exit(1);
  }
  return linkWarnings;
}

runLinkCheck()
  .then((linkWarnings) => {
    if (errors > 0) {
      console.error(`\n${errors} error(s) in ${checked} file(s). Fix before committing.`);
      process.exit(1);
    }
    console.log(
      `✓ ${checked} data file(s) valid (${providers.size} providers, ${slugs.size} models)` +
        (linkWarnings > 0 ? ` · ${linkWarnings} link warning(s)` : ` · ${sourceUrls.size} source URLs OK`),
    );
  })
  .catch((e) => {
    console.error(`✗ link checker crashed: ${(e as Error).message}`);
    process.exit(strict ? 1 : 0);
  });
