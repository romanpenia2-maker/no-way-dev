import Link from "next/link";
import { EmailCapture } from "@/components/email-capture";
import { site } from "@/lib/site";

const links = [
  { href: "/pricing", label: "Pricing" },
  { href: "/calculators/cost", label: "Cost Calculator" },
  { href: "/guides", label: "Guides" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
  { href: "/sitemap.xml", label: "Sitemap" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-content gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6">
        <div className="space-y-4">
          <p className="text-base font-semibold tracking-tight">
            no-way<span className="text-accent">.dev</span>
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Weekly-updated AI API pricing, verified against official sources. Get price-change digests in your inbox.
          </p>
          <EmailCapture />
        </div>
        <nav className="grid grid-cols-2 gap-2 text-sm sm:justify-items-end" aria-label="Footer">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <a href={site.github} className="text-muted-foreground hover:text-foreground" rel="noopener">
            GitHub
          </a>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-content flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} {site.name}. Dataset: CC BY-SA.</span>
          <span>Sample data — always verify prices on official provider pages.</span>
        </div>
      </div>
    </footer>
  );
}
