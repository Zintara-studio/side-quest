"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";
import { gameChips, teammates } from "@/lib/mock/league";

const fieldLabel = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".16em",
  color: SQ.label,
} as const;

const card = {
  background: SQ.panel,
  border: `1px solid ${SQ.hairline}`,
  borderRadius: 8,
  padding: 26,
} as const;

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: 26,
  marginTop: 24,
  alignItems: "start",
} as const;

const submitBtn = {
  cursor: "pointer",
  marginTop: 24,
  textAlign: "center",
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: SQ.league,
  background: SQ.red,
  padding: 14,
  borderRadius: 5,
  textDecoration: "none",
  display: "block",
} as const;

function Field({ children, muted }: { children: string; muted?: boolean }) {
  return (
    <div
      style={{
        background: SQ.inset,
        border: `1px solid ${SQ.field}`,
        borderRadius: 5,
        padding: "13px 14px",
        fontSize: 14,
        color: muted ? SQ.mute : SQ.ink,
      }}
    >
      {children}
    </div>
  );
}

function ContactRow() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 140 }}>
        <Field muted>WhatsApp no.</Field>
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <Field muted>Email</Field>
      </div>
    </div>
  );
}

export function RegisterScreen() {
  const [mode, setMode] = useState<"franchise" | "ffa">("franchise");

  const tab = (active: boolean) =>
    ({
      cursor: "pointer",
      fontFamily: FONT.mono,
      fontSize: 12,
      letterSpacing: ".12em",
      textTransform: "uppercase",
      fontWeight: 600,
      padding: "11px 18px",
      borderRadius: 5,
      border: "none",
      color: active ? SQ.league : SQ.faint,
      background: active ? SQ.red : "transparent",
    }) as const;

  return (
    <div>
      <LeagueTitle eyebrow="Season 04 registration" title="REGISTER TO PLAY" />

      <div
        style={{
          display: "flex",
          gap: 8,
          margin: "26px 0 8px",
          background: SQ.panel,
          border: `1px solid ${SQ.hairline}`,
          borderRadius: 8,
          padding: 6,
          width: "fit-content",
          maxWidth: "100%",
          flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={() => setMode("franchise")} style={tab(mode === "franchise")}>
          Franchise Season
        </button>
        <button type="button" onClick={() => setMode("ffa")} style={tab(mode === "ffa")}>
          Free-For-All
        </button>
      </div>

      {mode === "franchise" ? (
        <div style={grid}>
          <div style={card}>
            <div style={{ ...fieldLabel, marginBottom: 8 }}>PLAYER NAME · AUTOFILL</div>
            <Field>Raghavan Iyer</Field>
            <div style={{ ...fieldLabel, margin: "20px 0 8px" }}>CONTACT</div>
            <ContactRow />
            <div style={{ ...fieldLabel, margin: "20px 0 8px" }}>
              YOUR GAMES · SELECT &amp; SET PROFICIENCY
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {gameChips.map((c) => (
                <div
                  key={c.label}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".06em",
                    padding: "9px 13px",
                    borderRadius: 5,
                    border: `1px solid ${c.selected ? SQ.red : SQ.inputBorder}`,
                    color: c.selected ? SQ.league : SQ.faint,
                    background: c.selected ? SQ.red : "transparent",
                  }}
                >
                  {c.label}
                </div>
              ))}
            </div>
            <Link href="/player" style={submitBtn}>
              Submit registration ▸
            </Link>
          </div>

          <div style={card}>
            <div style={{ ...fieldLabel, marginBottom: 14 }}>PROFILE PHOTO</div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  background:
                    "repeating-linear-gradient(45deg,#1d2026,#1d2026 9px,#222630 9px,#222630 18px)",
                  border: `1px solid ${SQ.field}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  color: SQ.label,
                  letterSpacing: ".1em",
                }}
              >
                UPLOAD
              </div>
              <div style={{ fontSize: 13, color: SQ.mute, lineHeight: 1.5 }}>
                Use your avatar if well-known,
                <br />
                or upload a clear face shot.
              </div>
            </div>
            <div style={{ ...fieldLabel, margin: "24px 0 8px" }}>REGISTRATION NOTE</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: SQ.faint }}>
              Franchise managers will see your profile in the auction pool. League admins decide your
              seed value from your match history and proficiency.
            </p>
          </div>
        </div>
      ) : (
        <div style={grid}>
          <div style={card}>
            <div style={{ ...fieldLabel, marginBottom: 8 }}>PLAYER NAME</div>
            <Field>Raghavan Iyer</Field>
            <div style={{ ...fieldLabel, margin: "20px 0 8px" }}>CONTACT</div>
            <ContactRow />
            <Link href="/match" style={submitBtn}>
              Lock squad &amp; register ▸
            </Link>
          </div>

          <div style={card}>
            <div style={{ ...fieldLabel, marginBottom: 12 }}>BUILD YOUR SQUAD · INVITE TEAMMATES</div>
            {teammates.map((m, i) => (
              <div
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}
              >
                <div
                  style={{
                    flex: 1,
                    background: SQ.inset,
                    border: `1px solid ${SQ.field}`,
                    borderRadius: 5,
                    padding: "12px 14px",
                    fontSize: 13,
                    color: m.invited ? SQ.ink : SQ.mute,
                  }}
                >
                  {m.text}
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".12em",
                    color: m.invited ? SQ.green : SQ.league,
                    border: `1px solid ${m.invited ? "rgba(63,207,142,.4)" : SQ.red}`,
                    background: m.invited ? "transparent" : SQ.red,
                    padding: "11px 14px",
                    borderRadius: 5,
                  }}
                >
                  {m.invited ? "INVITED" : "INVITE"}
                </div>
              </div>
            ))}
            <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.6, color: SQ.mute }}>
              Search players already on Side Quest, or send an invite link — works like on-the-spot
              registration.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
