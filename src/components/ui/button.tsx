import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-ink text-paper hover:bg-ink/90",
  secondary: "border border-line text-ink hover:bg-ink hover:text-paper",
  outline: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink hover:bg-ink hover:text-paper",
  link: "text-ink underline underline-offset-4 hover:bg-ink hover:text-paper hover:no-underline",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-10 min-h-10 px-4 py-2",
  sm: "h-10 min-h-10 px-3 text-xs",
  lg: "h-10 px-6",
  icon: "h-9 w-9",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none font-mono text-sm font-bold uppercase tracking-[0.06em]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink focus-visible:ring-offset-1 focus-visible:ring-offset-paper",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
