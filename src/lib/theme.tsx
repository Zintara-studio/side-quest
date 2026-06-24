"use client";

// Light/dark theme controller. The actual `data-theme` attribute is set pre-paint by an inline
// script in the root layout (no flash); this hook reads it on mount and lets the user flip it.
import { useEffect, useState, type CSSProperties } from "react";
import { Sun, Moon } from "lucide-react";
import { SQ, FONT } from "@/components/sidequest/tokens";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = (document.documentElement.dataset.theme as Theme) ?? "light";
    setThemeState(t === "dark" ? "dark" : "light");
    setMounted(true);
  }, []);

  const setTheme = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("sq-theme", t);
    } catch {
      /* ignore */
    }
    setThemeState(t);
  };

  const toggle = () => setTheme(theme === "light" ? "dark" : "light");

  return { theme, toggle, setTheme, mounted };
}

const iconBtnBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 6,
  border: `1px solid ${SQ.inputBorder}`,
  background: "transparent",
  color: SQ.mute,
  cursor: "pointer",
  flex: "0 0 auto",
  fontFamily: FONT.mono,
};

/** Sun/moon button that toggles the warm-paper ⇄ warm-espresso themes. */
export function ThemeToggle({ style }: { style?: CSSProperties }) {
  const { theme, toggle, mounted } = useTheme();
  const dark = mounted && theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      title={dark ? "Switch to light" : "Switch to dark"}
      style={{ ...iconBtnBase, ...style }}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
