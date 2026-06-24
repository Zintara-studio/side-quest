"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import { sortChips } from "@/lib/mock/league";
import { usePlayers } from "@/lib/query/hooks";
import { adaptPlayers } from "@/lib/adapters/league";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

export function PlayersScreen() {
  const { data, isLoading, isError } = usePlayers({ limit: 50 });
  const players = data ? adaptPlayers(data.items) : [];

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? players.filter((p) => `${p.name} ${p.fr}`.toLowerCase().includes(q))
    : players;

  return (
    <div>
      <LeagueTitle eyebrow="Registered players" title="PLAYERS" />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          margin: "18px 0 22px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute }}>
          {players.length} REGISTERED · SEASON 04
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players…"
            className="sq-field"
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".04em",
              color: SQ.ink,
              background: SQ.inset,
              border: `1px solid ${SQ.field}`,
              borderRadius: 5,
              padding: "8px 12px",
              minWidth: 180,
            }}
          />
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: ".1em",
              color: SQ.label,
              alignSelf: "center",
            }}
          >
            SORT
          </span>
          {sortChips.map((c) => (
            <div
              key={c.label}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".06em",
                padding: "8px 12px",
                borderRadius: 5,
                border: `1px solid ${c.selected ? SQ.red : SQ.inputBorder}`,
                color: c.selected ? SQ.league : SQ.faint,
                background: c.selected ? SQ.red : "transparent",
                cursor: "pointer",
              }}
            >
              {c.label}
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <StateNote>Loading players…</StateNote>
      ) : players.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't reach the league API." : "No players registered yet."}
        </StateNote>
      ) : filtered.length === 0 ? (
        <StateNote>No players match “{query}”.</StateNote>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
          <div style={{ minWidth: 620 }}>
            <div
              style={{
                display: "flex",
                padding: "14px 18px",
                borderBottom: `1px solid ${SQ.hairline}`,
                ...headCell,
              }}
            >
              <div style={{ width: 44 }}>#</div>
              <div style={{ flex: 1 }}>PLAYER</div>
              <div style={{ width: 160 }}>FRANCHISE</div>
              <div style={{ width: 80, textAlign: "right" }}>POINTS</div>
              <div style={{ width: 120, textAlign: "right" }}>REGION</div>
            </div>
            {filtered.map((p, i) => (
              <Link
                key={p.id}
                href={`/player/${p.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "13px 18px",
                  borderBottom: `1px solid ${SQ.hairlineSoft}`,
                  cursor: "pointer",
                  textDecoration: "none",
                  color: SQ.ink,
                }}
              >
                <div
                  style={{
                    width: 44,
                    fontFamily: FONT.display,
                    fontSize: 15,
                    color: i === 0 ? SQ.red : SQ.steel,
                  }}
                >
                  {p.rank}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 11 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: SQ.avatar,
                      border: `1px solid ${SQ.avatarBorder}`,
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</span>
                </div>
                <div style={{ width: 160, fontFamily: FONT.mono, fontSize: 12, color: SQ.faint }}>
                  {p.fr}
                </div>
                <div
                  style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 16 }}
                >
                  {p.pts}
                </div>
                <div
                  style={{
                    width: 120,
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    color: SQ.mute,
                  }}
                >
                  {p.tags}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
