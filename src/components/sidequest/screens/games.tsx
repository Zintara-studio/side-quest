"use client";

import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import { useGames } from "@/lib/query/hooks";
import { adaptGames } from "@/lib/adapters/league";

const bannerHatch = SQ.hatch;

const statLabel = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".1em",
  color: SQ.label,
} as const;

export function GamesScreen() {
  const { data, isLoading, isError } = useGames(true);
  const games = data ? adaptGames(data) : [];

  return (
    <div>
      <LeagueTitle eyebrow="Titles in play" title="SUPPORTED GAMES" />
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".1em",
          color: SQ.mute,
          margin: "14px 0 30px",
          paddingBottom: 26,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        {games.length} {games.length === 1 ? "TITLE" : "TITLES"} · LIVE POPULARITY INDEX
      </div>

      {isLoading ? (
        <StateNote>Loading games…</StateNote>
      ) : games.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't reach the league API." : "No games published yet."}
        </StateNote>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))",
            gap: 20,
          }}
        >
          {games.map((g) => (
            <Link
              key={g.name}
              href="/match"
              style={{
                cursor: "pointer",
                background: SQ.panel,
                border: `1px solid ${SQ.hairline}`,
                borderRadius: 8,
                overflow: "hidden",
                textDecoration: "none",
                color: SQ.ink,
                display: "block",
              }}
            >
              <div
                style={{
                  height: 96,
                  background: bannerHatch,
                  borderBottom: `1px solid ${SQ.hairline}`,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                }}
              >
                <span style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: "-.02em" }}>
                  {g.name}
                </span>
                <span
                  style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".12em", color: SQ.mute }}
                >
                  {g.format}
                </span>
              </div>
              <div style={{ padding: 18 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: FONT.mono,
                    fontSize: 10.5,
                    letterSpacing: ".1em",
                    color: SQ.label,
                  }}
                >
                  <span>POPULARITY</span>
                  <span style={{ color: SQ.ink }}>{g.pop}/100</span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: SQ.track,
                    borderRadius: 3,
                    marginTop: 8,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ height: "100%", width: `${g.pop}%`, background: SQ.red }} />
                </div>
                <div style={{ marginTop: 18 }}>
                  <div style={statLabel}>FORMAT</div>
                  <div style={{ fontFamily: FONT.display, fontSize: 18, marginTop: 5 }}>
                    {g.format}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: SQ.ember,
                  }}
                >
                  View matches ▸
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
