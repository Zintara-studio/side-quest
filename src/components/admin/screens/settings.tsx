"use client";

import type { ReactNode } from "react";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { Toggle } from "../toggle";
import { StateNote } from "@/components/sidequest/state-note";
import { useSettings } from "@/lib/query/hooks";

const cardHeader = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: SQ.ink,
} as const;

const cardStyle = {
  background: SQ.panel,
  border: `1px solid ${SQ.hairline}`,
  borderRadius: 9,
  padding: 22,
} as const;

function Row({ label, children, center }: { label: string; children: ReactNode; center?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: center ? "center" : undefined,
        justifyContent: "space-between",
        padding: "12px 0",
        borderTop: `1px solid ${SQ.hairlineFaint}`,
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
  const { data: s, isLoading, isError } = useSettings();

  return (
    <div>
      <ScreenHeader eyebrow="League configuration" title="SETTINGS" />

      {isLoading ? (
        <div style={{ marginTop: 24 }}>
          <StateNote>Loading settings…</StateNote>
        </div>
      ) : !s ? (
        <div style={{ marginTop: 24 }}>
          <StateNote tone={isError ? "error" : "muted"}>
            {isError ? "Couldn't load settings (admin sign-in required)." : "No settings found."}
          </StateNote>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: 24,
            marginTop: 24,
            alignItems: "start",
          }}
        >
          <div style={cardStyle}>
            <div style={{ ...cardHeader, marginBottom: 16 }}>Season</div>
            <Row label="Current season">{s.seasonName || s.seasonId || "—"}</Row>
            <Row label="Registration open" center>
              <Toggle on={s.registrationOpen} />
            </Row>
          </div>

          <div style={cardStyle}>
            <div style={{ ...cardHeader, marginBottom: 16 }}>Scoring</div>
            <Row label="Points per kill">{String(s.pointsPerKill)}</Row>
            <Row label="Placement points">{s.placementPoints || "—"}</Row>
            <Row label="Last updated">
              {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "—"}
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}
