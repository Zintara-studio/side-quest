import type { ReactNode } from "react";
import { SQ, FONT } from "./tokens";

export function ScreenHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: SQ.red,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: "clamp(34px,5vw,54px)",
            lineHeight: 0.92,
            letterSpacing: "-.03em",
            marginTop: 10,
          }}
        >
          {title}
        </div>
      </div>
      {action}
    </div>
  );
}
