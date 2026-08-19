/**
 * Validates every JSON file in /data against the zod schemas in /data/schemas.
 * Also runs cross-file checks (e.g. model.provider must exist in data/providers).
 *
 * Usage: npm run validate-data
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modelSchema, type Model } from "../data/schemas/model.schema";
import { providerSchema, type Provider } from "../data/schemas/provider.schema";
import { benchmarksMetaSchema } from "../data/schemas/benchmarks-meta.schema";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modelsDir = path.join(root, "data", "models");
const providersDir = path.join(root, "data", "providers");
const metaDir = path.join(root, "data", "meta");

let errors = 0;
let checked = 0;

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
    } catch (e) {
      fail(`data/meta/${file}`, `invalid JSON: ${(e as Error).message}`);
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} error(s) in ${checked} file(s). Fix before committing.`);
  process.exit(1);
}
console.log(`✓ ${checked} data file(s) valid (${providers.size} providers, ${slugs.size} models)`);
