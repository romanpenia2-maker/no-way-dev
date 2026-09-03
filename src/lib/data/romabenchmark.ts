import fs from "node:fs";
import path from "node:path";
import { romabenchmarkSchema, type RomaBenchmark } from "@data/schemas/romabenchmark.schema";

const dataFile = path.join(process.cwd(), "data", "meta", "romabenchmark.json");

let cache: RomaBenchmark | null = null;

/** RomaBenchmark run results — data/meta/romabenchmark.json, parsed once. */
export function getRomaBenchmark(): RomaBenchmark {
  if (cache) return cache;
  cache = romabenchmarkSchema.parse(JSON.parse(fs.readFileSync(dataFile, "utf8")));
  return cache;
}
