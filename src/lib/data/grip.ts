import fs from "node:fs";
import path from "node:path";
import { gripEntriesSchema, type GripEntry } from "@data/schemas/grip.schema";

const entriesPath = path.join(process.cwd(), "data", "grip", "entries.json");

/**
 * Build-time snapshot of the grip leaderboard. The /grip page fetches the live
 * file from raw.githubusercontent.com (revalidate 60s) so new entries appear
 * without a rebuild; this bundled copy is only the offline/error fallback.
 */
export function getBundledGripEntries(): GripEntry[] {
  try {
    return gripEntriesSchema.parse(JSON.parse(fs.readFileSync(entriesPath, "utf8")));
  } catch {
    return [];
  }
}
