"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { useSettings, useUpdateSettings, useCurrentSeason } from "@/lib/query/hooks";

const numberInput = {
  width: 88,
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "8px 10px",
  fontSize: 13,
  color: SQ.ink,
  fontFamily: FONT.mono,
  textAlign: "right",
} as const;

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
  // The live current season is authoritative at /seasons/current — the stored settings.seasonName can
  // go stale (it's only written on season start, never cleared on finish).
  const seasonQ = useCurrentSeason();
  const update = useUpdateSettings();

  // Local, editable copy of the registration lock window; re-synced whenever settings load/refresh.
  const [lockHours, setLockHours] = useState("");
  useEffect(() => {
    if (s) setLockHours(String(s.registrationLockHours));
  }, [s]);

  const lockDirty = !!s && lockHours.trim() !== String(s.registrationLockHours);
  const saveLockHours = () => {
    if (!lockDirty) return;
    update.mutate({ registrationLockHours: Math.max(0, Math.floor(Number(lockHours) || 0)) });
  };

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
            <Row label="Current season">{seasonQ.data ? seasonQ.data.name : "Between seasons"}</Row>
            <Row label="Registration lock (hours)" center>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  value={lockHours}
                  onChange={(e) => setLockHours(e.target.value)}
                  style={numberInput}
                />
                <button
                  type="button"
                  onClick={saveLockHours}
                  disabled={!lockDirty || update.isPending}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10.5,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: SQ.sidebar,
                    background: SQ.red,
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: 5,
                    cursor: !lockDirty || update.isPending ? "not-allowed" : "pointer",
                    opacity: !lockDirty || update.isPending ? 0.5 : 1,
                  }}
                >
                  {update.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </Row>
            <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute, marginTop: 8, lineHeight: 1.5 }}>
              Match registrations lock this many hours before the match starts — pending squad invites
              are voided at lock time.
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ ...cardHeader, marginBottom: 16 }}>Scoring</div>
            <div style={{ fontSize: 13.5, color: SQ.faint, lineHeight: 1.6 }}>
              Scoring is now configured <strong style={{ color: SQ.ink }}>per game</strong> — each title
              sets its own points-per-kill, placement ladder and how much it weighs toward the franchise
              standings.
            </div>
            <Link
              href="/admin/games"
              style={{
                display: "inline-block",
                marginTop: 14,
                fontFamily: FONT.mono,
                fontSize: 10.5,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: SQ.ember,
                border: `1px solid ${SQ.inputBorder}`,
                padding: "9px 14px",
                borderRadius: 5,
                textDecoration: "none",
              }}
            >
              Configure game scoring ▸
            </Link>
            <Row label="Last updated">
              {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "—"}
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}
