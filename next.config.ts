import type { NextConfig } from "next";

// vercel.live hosts Vercel's live-feedback widget, injected on the rc/preview
// deployment (rc.no-way.dev is a production-mode deployment, so VERCEL_ENV
// can't discriminate) — allow it unconditionally; it never loads on prod.
const vercelLive = " https://vercel.live";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Baseline CSP: Next.js App Router needs 'unsafe-inline' for inline
          // hydration scripts/styles; frame-ancestors duplicates X-Frame-Options
          // for modern browsers. Tighten with nonces when a CSP reporter exists.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${vercelLive}`,
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://raw.githubusercontent.com${vercelLive}`,
              "font-src 'self'",
              `connect-src 'self' https://raw.githubusercontent.com https://api.github.com${vercelLive}`,
              `frame-src 'self'${vercelLive}`,
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
