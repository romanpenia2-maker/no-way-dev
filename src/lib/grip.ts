import { site } from "@/lib/site";

/**
 * Shared constants for the grip-strength leaderboard (client-safe — no node
 * builtins). Entries and photos live in the repo under data/grip/ and are read
 * at runtime from raw.githubusercontent.com so fresh rows show up without a
 * rebuild (the page falls back to the bundled snapshot if the fetch fails).
 */

export const GRIP_BRANCH = "rc";
export const GRIP_ENTRIES_PATH = "data/grip/entries.json";

const RAW_BASE = `${site.github.replace("https://github.com", "https://raw.githubusercontent.com")}/${GRIP_BRANCH}`;

export const GRIP_ENTRIES_RAW_URL = `${RAW_BASE}/${GRIP_ENTRIES_PATH}`;

/** Runtime URL of an uploaded dynamometer photo. */
export function gripPhotoUrl(photoPath: string): string {
  return `${RAW_BASE}/${photoPath}`;
}

/** "62 kg" / "62.5 kg" — leaderboard figures. */
export function formatKg(kg: number): string {
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

/** "Aug 21, 2026" from a full ISO timestamp. */
export function formatGripDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
