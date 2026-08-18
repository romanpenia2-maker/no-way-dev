import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        /* E-ink tokens */
        paper: "var(--paper)",
        backdrop: "var(--backdrop)",
        ink: "var(--px)",
        ink2: "var(--px2)",
        line: "var(--line)",
        /* Legacy aliases → tokens, so any leftover class stays monochrome */
        background: "var(--paper)",
        foreground: "var(--px)",
        card: {
          DEFAULT: "var(--paper)",
          foreground: "var(--px)",
        },
        muted: {
          DEFAULT: "var(--line)",
          foreground: "var(--px2)",
        },
        accent: {
          DEFAULT: "var(--px)",
          foreground: "var(--paper)",
        },
        border: "var(--line)",
        input: "var(--px2)",
        ring: "var(--px)",
      },
      borderRadius: {
        lg: "2px",
        md: "2px",
        sm: "0px",
      },
      fontFamily: {
        display: ["var(--font-archivo)", "var(--font-inter)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jbmono)", "var(--mono)"],
      },
      maxWidth: {
        content: "1160px",
      },
    },
  },
  plugins: [],
};

export default config;
