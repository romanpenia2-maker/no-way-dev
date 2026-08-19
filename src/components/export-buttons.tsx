"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Legacy fallback for non-secure contexts where navigator.clipboard is unavailable. */
function fallbackCopy(text: string) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    // no-op — nothing more we can do
  }
  document.body.removeChild(ta);
}

/** Two-button export: copies the current table view as CSV or Markdown. */
export function ExportButtons({ csv, markdown }: { csv: string; markdown: string }) {
  const [copied, setCopied] = useState<"csv" | "md" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (text: string, kind: "csv" | "md") => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      fallbackCopy(text);
    }
    setCopied(kind);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1500);
  }, []);

  const btn =
    "flex h-11 items-center border border-ink px-3 font-mono text-[11px] uppercase tracking-[0.08em] sm:h-9 [@media(hover:hover)]:hover:bg-ink [@media(hover:hover)]:hover:text-paper";

  return (
    <div className="flex items-center gap-2" aria-label="Export table">
      <button type="button" className={cn(btn)} onClick={() => copy(csv, "csv")}>
        {copied === "csv" ? "Copied ✓" : "Copy CSV"}
      </button>
      <button type="button" className={cn(btn)} onClick={() => copy(markdown, "md")}>
        {copied === "md" ? "Copied ✓" : "Copy Markdown"}
      </button>
    </div>
  );
}
