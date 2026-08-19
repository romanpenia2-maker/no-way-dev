import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "solid";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "border-ink text-ink",
  secondary: "border-line text-ink2",
  outline: "border-ink text-ink",
  /* инвертированная плашка — единственный «акцент» системы */
  solid: "border-ink bg-ink text-paper",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-none border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.08em]",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
