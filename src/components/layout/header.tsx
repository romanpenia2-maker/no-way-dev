"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/pricing", label: "Pricing", match: "/pricing" },
  { href: "/benchmarks", label: "Benchmarks", match: "/benchmarks" },
  { href: "/calculators/cost", label: "Calculator", match: "/calculators" },
  { href: "/guides", label: "Guides", match: "/guides" },
  { href: "/about", label: "About", match: "/about" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);

  const isActive = (match: string) => pathname === match || pathname.startsWith(`${match}/`);

  // Esc closes the mobile menu and returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        burgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b-[1.5px] border-ink bg-paper">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-12">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-display text-lg font-extrabold lowercase leading-none tracking-[-0.03em]"
            onClick={() => setOpen(false)}
          >
            no-way.dev
          </Link>
          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-ink2 sm:block">
            e-ink · 100% ▮ · refresh 60 min
          </span>
        </div>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.match) ? "page" : undefined}
              className={cn(
                "px-3 py-1.5 text-sm font-medium",
                isActive(item.match)
                  ? "bg-ink text-paper"
                  : "text-ink2 hover:bg-ink hover:text-paper",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          ref={burgerRef}
          className="flex h-11 items-center border border-ink px-3 font-mono text-[10px] uppercase tracking-[0.08em] hover:bg-ink hover:text-paper sm:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open ? (
        <nav id="mobile-nav" className="border-t border-line sm:hidden" aria-label="Mobile navigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.match) ? "page" : undefined}
              className={cn(
                "block border-b border-line px-4 py-3 text-sm font-medium last:border-b-0",
                isActive(item.match) ? "bg-ink text-paper" : "text-ink hover:bg-ink hover:text-paper",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
