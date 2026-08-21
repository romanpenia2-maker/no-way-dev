/**
 * Generic best-effort in-memory rate limiter, same trade-offs as the detector
 * one: on serverless each warm instance has its own map, so this caps abuse
 * per instance rather than globally. Deliberately simple; a durable store
 * (e.g. Vercel KV) is the upgrade path if abuse becomes real.
 */

interface Bucket {
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  maxKeys?: number;
}): RateLimiter {
  const { windowMs, maxRequests } = options;
  const maxKeys = options.maxKeys ?? 10_000;
  const buckets = new Map<string, Bucket>();

  function prune(now: number): void {
    if (buckets.size <= maxKeys) return;
    // Drop the oldest buckets to bound memory on a long-lived instance.
    for (const [key, bucket] of buckets) {
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
      if (bucket.timestamps.length === 0) buckets.delete(key);
      if (buckets.size <= maxKeys / 2) break;
    }
  }

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      prune(now);
      const bucket = buckets.get(key) ?? { timestamps: [] };
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
      buckets.set(key, bucket);

      if (bucket.timestamps.length >= maxRequests) {
        const oldest = bucket.timestamps[0];
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
        };
      }
      bucket.timestamps.push(now);
      return {
        allowed: true,
        remaining: maxRequests - bucket.timestamps.length,
        retryAfterSeconds: 0,
      };
    },
  };
}

/** Best client identifier available on Vercel edge-proxied requests. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
