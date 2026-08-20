/**
 * Best-effort in-memory rate limiter for /api/detect.
 *
 * Caveat: on serverless each instance has its own map, so this caps abuse per
 * warm instance rather than globally. It is deliberately simple for the MVP;
 * a durable store (e.g. Vercel KV) is the v1.5 upgrade path.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 30;
const MAX_KEYS = 10_000;

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

function prune(now: number): void {
  if (buckets.size <= MAX_KEYS) return;
  // Drop the oldest buckets to bound memory on a long-lived instance.
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
    if (bucket.timestamps.length === 0) buckets.delete(key);
    if (buckets.size <= MAX_KEYS / 2) break;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  prune(now);
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
  buckets.set(key, bucket);

  if (bucket.timestamps.length >= MAX_REQUESTS) {
    const oldest = bucket.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }
  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: MAX_REQUESTS - bucket.timestamps.length,
    retryAfterSeconds: 0,
  };
}
