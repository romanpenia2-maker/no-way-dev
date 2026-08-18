import { z } from "zod";

export const providerSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  name: z.string().min(1),
  websiteUrl: z.string().url(),
  pricingUrl: z.string().url(),
  apiDocsUrl: z.string().url(),
});

export type Provider = z.infer<typeof providerSchema>;
