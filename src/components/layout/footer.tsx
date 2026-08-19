import Link from "next/link";
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
    <footer className="border-t-[1.5px] border-ink">
      <div className="flex flex-col gap-8 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-12">
        <div className="space-y-2">
          <p className="font-display text-lg font-extrabold lowercase leading-none tracking-[-0.03em]">
            no-way.dev
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink2">
            concept P «E-ink»
          </p>
          <p className="max-w-xs pt-2 text-sm text-ink2">
            Weekly-updated AI API pricing, verified against official sources. Every number has a source.
          </p>
        </div>
        <nav
          className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:justify-items-end"
          aria-label="Footer"
        >
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="py-1.5 text-ink2 underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline">
              {l.label}
            </Link>
          ))}
          <a href={site.github} rel="noopener" className="py-1.5 text-ink2 underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline">
            GitHub
          </a>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="flex flex-col gap-1 px-4 py-4 font-mono text-[11px] tracking-[0.04em] text-ink2 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-12">
          <span>© {new Date().getFullYear()} {site.name} · dataset CC BY-SA · sample data — verify on official pages</span>
          <span>not sponsored · data weekly</span>
        </div>
      </div>
    </footer>
  );
}
