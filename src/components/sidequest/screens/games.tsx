"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import { Modal } from "../modal";
import { useGames, useMyGameVotes, useSaveGameVotes } from "@/lib/query/hooks";
import { useAuth, apiErrorMessage } from "@/lib/auth/context";
import { adaptGames } from "@/lib/adapters/league";
import type { GameSummary } from "@/lib/api/types";

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
  const [voteOpen, setVoteOpen] = useState(false);

  return (
    <div>
      <LeagueTitle eyebrow="Titles in play" title="SUPPORTED GAMES" />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          margin: "14px 0 30px",
          paddingBottom: 26,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute }}>
          {games.length} {games.length === 1 ? "TITLE" : "TITLES"} · LIVE POPULARITY INDEX
        </div>
        {/* Community popularity is vote-driven — available to everyone, at all times. */}
        <button
          type="button"
          onClick={() => setVoteOpen(true)}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: SQ.league,
            background: SQ.red,
            border: "none",
            borderRadius: 6,
            padding: "9px 15px",
            cursor: "pointer",
          }}
        >
          ▲ Vote for your games
        </button>
      </div>

      {voteOpen ? <VotePanel onClose={() => setVoteOpen(false)} /> : null}

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

/**
 * The "Vote for your games" panel: toggle the games you like, save, and each title's popularity is
 * recomputed as the share of voters who upvoted it. Open to everyone; anonymous visitors get a
 * sign-in prompt instead of the toggles.
 */
function VotePanel({ onClose }: { onClose: () => void }) {
  const { isAuthenticated } = useAuth();
  const gamesQ = useGames(true);
  const votesQ = useMyGameVotes(isAuthenticated);
  const save = useSaveGameVotes();
  const games: GameSummary[] = gamesQ.data ?? [];

  const [selected, setSelected] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the selection from the user's existing votes once they load.
  useEffect(() => {
    if (!seeded && votesQ.data) {
      setSelected(votesQ.data.votedGameIds);
      setSeeded(true);
    }
  }, [votesQ.data, seeded]);

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const onSave = async () => {
    setError(null);
    try {
      await save.mutateAsync({ gameIds: selected });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't save your votes. Please try again."));
    }
  };

  return (
    <Modal open title="Vote for your games" onClose={save.isPending ? () => {} : onClose}>
      {!isAuthenticated ? (
        <div style={{ maxWidth: 460 }}>
          <p style={{ fontSize: 13.5, color: SQ.faint, lineHeight: 1.6, marginTop: 0 }}>
            Popularity is decided by the community. <Link href="/login" style={{ color: SQ.ember }}>Sign in</Link>{" "}
            to upvote the games you play — each title&rsquo;s popularity is the share of voters who back it.
          </p>
        </div>
      ) : (
        <div style={{ maxWidth: 520 }}>
          <p style={{ fontSize: 13, color: SQ.faint, lineHeight: 1.6, margin: "0 0 16px" }}>
            Tap the games you want to back. A title&rsquo;s popularity is the share of all voters who upvote
            it — vote for as many as you like, then save.
          </p>
          {votesQ.isLoading ? (
            <StateNote>Loading your votes…</StateNote>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {games.map((g) => {
                const on = selected.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggle(g.id)}
                    style={{
                      fontFamily: FONT.sans,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "9px 14px",
                      borderRadius: 999,
                      border: `1px solid ${on ? SQ.red : SQ.inputBorder}`,
                      color: on ? SQ.league : SQ.ink,
                      background: on ? SQ.red : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    {on ? "▲ " : ""}
                    {g.name}
                  </button>
                );
              })}
            </div>
          )}

          {error ? <StateNote tone="error">{error}</StateNote> : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={save.isPending}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: SQ.faint,
                background: "transparent",
                border: `1px solid ${SQ.inputBorder}`,
                borderRadius: 6,
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={save.isPending}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: SQ.league,
                background: SQ.red,
                border: "none",
                borderRadius: 6,
                padding: "10px 18px",
                cursor: save.isPending ? "not-allowed" : "pointer",
                opacity: save.isPending ? 0.6 : 1,
              }}
            >
              {save.isPending ? "Saving…" : "Save votes"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
