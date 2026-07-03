import type { ReactNode } from "react";
import Link from "next/link";
import { SQ, FONT } from "@/components/sidequest/tokens";
import { SeasonCode } from "@/components/sidequest/season-code";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: SQ.league,
        color: SQ.ink,
        fontFamily: FONT.sans,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 408 }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 11,
            textDecoration: "none",
            color: SQ.ink,
            marginBottom: 22,
          }}
        >
          <div style={{ width: 13, height: 13, background: SQ.red, transform: "rotate(45deg)" }} />
          <span style={{ fontFamily: FONT.display, fontSize: 19, letterSpacing: ".005em" }}>
            SIDE QUEST
          </span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".14em",
              color: SQ.dim,
              border: `1px solid ${SQ.field}`,
              padding: "3px 7px",
              borderRadius: 3,
            }}
          >
            <SeasonCode fallback="SQ" />
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
