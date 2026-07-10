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

/** A small scoring-meta chip on a game card. */
function ScoreChip({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 10,
        letterSpacing: ".04em",
        color: accent ? SQ.ember : SQ.faint,
        border: `1px solid ${accent ? "rgba(232,96,44,.45)" : SQ.inputBorder}`,
        borderRadius: 5,
        padding: "4px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

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
              key={g.raw}
              href={`/match?game=${encodeURIComponent(g.raw)}`}
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
                  padding: "14px 18px",
                }}
              >
                {/* Title only — the format lives in the body below, so long names (MARVEL RIVALS,
                    SMASHKARTS) can wrap cleanly here instead of colliding with a subtitle. */}
                <span
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 22,
                    letterSpacing: "-.02em",
                    lineHeight: 1.05,
                    minWidth: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {g.name}
                </span>
                {/* Standings weight rides with the name — how much this title counts on the table. */}
                <span
                  title="Standings weight — how much this title counts toward franchise standings"
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    color: g.standingsWeight !== 100 ? SQ.ember : SQ.faint,
                    border: `1px solid ${g.standingsWeight !== 100 ? "rgba(232,96,44,.5)" : SQ.inputBorder}`,
                    borderRadius: 9,
                    padding: "3px 8px",
                    marginLeft: 10,
                    flex: "0 0 auto",
                  }}
                >
                  ×{(g.standingsWeight / 100).toFixed(2)}
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

                {/* scoring — public, so players know how each title is scored + how it weighs on the table */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${SQ.hairlineFaint}` }}>
                  <div style={statLabel}>SCORING</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    <ScoreChip label={`${g.pointsPerKill} pt/kill`} />
                    {g.placementPoints ? (
                      <ScoreChip label={`Placement ${g.placementPoints}`} />
                    ) : (
                      <ScoreChip label="Kills only" />
                    )}
                    <ScoreChip
                      label={`${(g.standingsWeight / 100).toFixed(2)}× standings`}
                      accent={g.standingsWeight !== 100}
                    />
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
