import type { ReactNode } from "react";
import { SQ, FONT } from "./tokens";

/** Inline loading / empty / error placeholder used wherever real API data is awaited. */
export function StateNote({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <div
      style={{
        padding: "44px 20px",
        textAlign: "center",
        fontFamily: FONT.mono,
        fontSize: 12.5,
        letterSpacing: ".08em",
        color: tone === "error" ? SQ.ember : SQ.mute,
        border: `1px dashed ${SQ.inputBorder}`,
        borderRadius: 8,
        background: SQ.panel,
      }}
    >
      {children}
    </div>
  );
}
