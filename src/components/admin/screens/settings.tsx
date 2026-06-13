import type { ReactNode } from "react";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { Toggle } from "../toggle";

const cardHeader = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: SQ.ink,
} as const;

const adminChip = {
  fontFamily: FONT.mono,
  fontSize: 11,
  color: SQ.faint,
  border: `1px solid ${SQ.inputBorder}`,
  padding: "7px 11px",
  borderRadius: 5,
} as const;

function Row({
  label,
  children,
  center,
}: {
  label: string;
  children: ReactNode;
  center?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: center ? "center" : undefined,
        justifyContent: "space-between",
        padding: "12px 0",
        borderTop: "1px solid rgba(255,255,255,.07)",
      }}
    >
      <div style={{ fontSize: 13.5 }}>{label}</div>
      {typeof children === "string" ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

export function SettingsScreen() {
  return (
    <div>
      <ScreenHeader eyebrow="League configuration" title="SETTINGS" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 24,
          marginTop: 24,
          alignItems: "start",
        }}
      >
        {/* Season */}
        <div
          style={{
            background: SQ.panel,
            border: `1px solid ${SQ.hairline}`,
            borderRadius: 9,
            padding: 22,
          }}
        >
          <div style={{ ...cardHeader, marginBottom: 16 }}>Season</div>
          <Row label="Current season">S04 — Spring</Row>
          <Row label="Registration window">01–30 APR</Row>
          <Row label="Registration open" center>
            <Toggle on />
          </Row>
          <Row label="Public leaderboard" center>
            <Toggle on />
          </Row>
        </div>

        {/* Scoring + Admin team */}
        <div
          style={{
            background: SQ.panel,
            border: `1px solid ${SQ.hairline}`,
            borderRadius: 9,
            padding: 22,
          }}
        >
          <div style={{ ...cardHeader, marginBottom: 16 }}>Scoring</div>
          <Row label="Points per kill">1</Row>
          <Row label="1st place bonus">15</Row>
          <Row label="Tiebreaker">Total kills</Row>

          <div style={{ ...cardHeader, margin: "24px 0 16px" }}>Admin team</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={adminChip}>Dev Mehta · OWNER</span>
            <span style={adminChip}>Nisha · MOD</span>
          </div>
        </div>
      </div>
    </div>
  );
}
