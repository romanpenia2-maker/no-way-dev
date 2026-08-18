/**
 * Weekly price-update bot (STUB).
 *
 * Runs from .github/workflows/update-prices.yml on a schedule. The workflow
 * opens a pull request via peter-evans/create-pull-request when this script
 * produces changes in /data.
 *
 * Intended full flow (phase 2+):
 *   1. For each provider in data/providers/, fetch pricingUrl (or use a
 *      per-provider scraper/adapter in scripts/bots/adapters/).
 *   2. Extract prices, compare with the current JSON entries.
 *   3. Write updated files with a fresh `updatedAt`, keeping `sourceUrl`.
 *   4. Run `npm run validate-data` and print a human-readable diff summary
 *      for the PR body (workflow appends git diff --stat).
 *
 * Current behaviour: loads all models, reports how many pricing entries would
 * be checked, and exits 0 without modifying anything, so CI stays green while
 * the adapters are being built.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modelSchema } from "../../data/schemas/model.schema";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const modelsDir = path.join(root, "data", "models");

async function main() {
  const files = fs.readdirSync(modelsDir).filter((f) => f.endsWith(".json"));
  let entries = 0;

  for (const file of files) {
    const model = modelSchema.parse(
      JSON.parse(fs.readFileSync(path.join(modelsDir, file), "utf8")),
    );
    for (const p of model.pricing) {
      entries += 1;
      // TODO(adapter): fetch p.sourceUrl, parse the pricing table for
      // `model.slug`, compare inputPer1M/outputPer1M/cachedInputPer1M and
      // update data/models/${file} when the delta is non-zero.
      console.log(`[skip] ${model.slug} @ ${p.provider} — adapter not implemented yet (${p.sourceUrl})`);
    }
  }

  console.log(
    `\nupdate-prices: checked ${entries} pricing entries across ${files.length} models. ` +
      `No adapters implemented yet — nothing changed.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
