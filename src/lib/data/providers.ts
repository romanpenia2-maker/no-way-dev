import fs from "node:fs";
import path from "node:path";
import { providerSchema, type Provider } from "@data/schemas/provider.schema";

const providersDir = path.join(process.cwd(), "data", "providers");

let cache: Provider[] | null = null;

export function getAllProviders(): Provider[] {
  if (cache) return cache;
  cache = fs
    .readdirSync(providersDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => providerSchema.parse(JSON.parse(fs.readFileSync(path.join(providersDir, f), "utf8"))));
  return cache;
}

export function getProvider(slug: string): Provider | undefined {
  return getAllProviders().find((p) => p.slug === slug);
}

export function getProviderName(slug: string): string {
  return getProvider(slug)?.name ?? slug;
}

/** slug → display name map, for passing into client components. */
export function getProviderNameMap(): Record<string, string> {
  return Object.fromEntries(getAllProviders().map((p) => [p.slug, p.name]));
}
