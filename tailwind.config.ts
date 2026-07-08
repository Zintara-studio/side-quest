import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        bg: {
          base: "#05060A",
          raised: "#0B0D14",
          panel: "#0F1220",
          line: "#1A1F33",
        },
        neon: {
          blue: "#3B82F6",
          electric: "#00E5FF",
          cyan: "#22D3EE",
          purple: "#A855F7",
          violet: "#8B5CF6",
          pink: "#EC4899",
          red: "#EF4444",
          lime: "#A3E635",
          amber: "#F59E0B",
        },
        ink: {
          DEFAULT: "#E5E7EB",
          muted: "#9CA3AF",
          dim: "#6B7280",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)",
        "radial-glow":
          "radial-gradient(60% 60% at 50% 0%, rgba(168,85,247,0.25) 0%, rgba(0,229,255,0.10) 35%, transparent 70%)",
        "neon-gradient":
          "linear-gradient(135deg, #00E5FF 0%, #8B5CF6 50%, #EC4899 100%)",
        "card-sheen":
          "linear-gradient(140deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 30%, transparent 60%)",
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(0,229,255,0.35), 0 0 24px rgba(0,229,255,0.25)",
        "neon-purple":
          "0 0 0 1px rgba(168,85,247,0.4), 0 0 24px rgba(168,85,247,0.35)",
        glow: "0 10px 40px -10px rgba(0,229,255,0.45)",
        panel: "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(0,0,0,0.5)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGlow: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(0,229,255,0.5)" },
          "50%": { boxShadow: "0 0 0 12px rgba(0,229,255,0)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s ease-out both",
        shimmer: "shimmer 2.4s linear infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        scan: "scan 3s linear infinite",
        marquee: "marquee 30s linear infinite",
        "spin-slow": "spin-slow 12s linear infinite",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
    },
  },
  plugins: [],
};

export default config;
