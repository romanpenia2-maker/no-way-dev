/**
 * /pricing URL-state contract — shared by the server page (searchParams parsing)
 * and the client table (hydration + router.replace sync). No node builtins.
 */

export const PRICING_SORT_KEYS = [
  "model",
  "provider",
  "input",
  "cached",
  "output",
  "context",
  "updated",
] as const;
export type PricingSortKey = (typeof PRICING_SORT_KEYS)[number];

/** ?ctx= option → minimum context window in tokens. */
export const CTX_MIN_OPTIONS: Record<string, number> = {
  "256k": 256_000,
  "500k": 500_000,
  "1m": 1_000_000,
  "2m": 2_000_000,
};

export interface PricingTableState {
  sortKey: PricingSortKey;
  sortAsc: boolean;
  provider: string;
  capability: string;
  openOnly: boolean;
  /** ?ctx= key ("" = Any). */
  ctx: string;
}

export const DEFAULT_PRICING_STATE: PricingTableState = {
  sortKey: "input",
  sortAsc: true,
  provider: "all",
  capability: "all",
  openOnly: false,
  ctx: "",
};
