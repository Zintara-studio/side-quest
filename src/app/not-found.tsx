import Link from "next/link";
import { SQ, FONT } from "@/components/sidequest/tokens";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: SQ.league,
        color: SQ.ink,
        fontFamily: FONT.sans,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".3em",
          textTransform: "uppercase",
          color: SQ.red,
        }}
      >
        404 · Match not found
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: "clamp(48px,9vw,96px)",
          lineHeight: 0.9,
          letterSpacing: "-.03em",
          marginTop: 16,
        }}
      >
        OFF THE MAP
      </div>
      <p style={{ maxWidth: 420, marginTop: 16, fontSize: 14, lineHeight: 1.6, color: SQ.mute }}>
        We couldn&apos;t find that page. It may have been re-bracketed, transferred, or never
        existed.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
        <Link
          href="/"
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: SQ.league,
            background: SQ.red,
            padding: "13px 20px",
            borderRadius: 5,
            textDecoration: "none",
          }}
        >
          ◂ Back to home
        </Link>
        <Link
          href="/franchises"
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: SQ.faint,
            border: `1px solid ${SQ.inputBorder}`,
            padding: "13px 20px",
            borderRadius: 5,
            textDecoration: "none",
          }}
        >
          Open standings
        </Link>
      </div>
    </div>
  );
}
