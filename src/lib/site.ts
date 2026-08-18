export const site = {
  name: "no-way.dev",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://no-way.dev",
  title: "no-way.dev — AI API Pricing Reference",
  description:
    "Up-to-date LLM API pricing across providers, cost calculators and practical guides. Every number has a source.",
  email: "hello@no-way.dev",
  github: "https://github.com/no-way-dev/no-way-dev",
} as const;
