"use client";

import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { Toggle } from "../toggle";
import { StateNote } from "@/components/sidequest/state-note";
import { useGames, useUpdateGame, useCurrentSeason } from "@/lib/query/hooks";
import type { GameType } from "@/lib/api/types";

const statLabel = {
  fontFamily: FONT.mono,
  fontSize: 9.5,
  letterSpacing: ".1em",
  color: SQ.label,
} as const;

const statValue = {
  fontFamily: FONT.mono,
  fontSize: 12,
  marginTop: 3,
} as const;

const typeBadge = {
  fontFamily: FONT.mono,
  fontSize: 9.5,
  letterSpacing: ".08em",
  padding: "3px 7px",
  borderRadius: 9,
  whiteSpace: "nowrap",
  flex: "0 0 auto",
} as const;

const typeSelect = {
  marginTop: 4,
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "6px 8px",
  fontFamily: FONT.mono,
  fontSize: 11.5,
  color: SQ.ink,
} as const;

/** Friendly genre labels shown in the type badge + the game-type <select>. */
const GAME_TYPE_LABEL: Record<GameType, string> = {
  BATTLE_ROYALE: "Battle Royale",
  TACTICAL: "Tactical",
  SPORTS: "Sports",
  FIGHTING: "Fighting",
  PARTY: "Party·FFA",
};

/** [text, border] badge colors per genre — mirrors the status-badge idiom in tokens.ts. */
const GAME_TYPE_COLORS: Record<GameType, [string, string]> = {
  BATTLE_ROYALE: [SQ.ember, "rgba(232,96,44,.45)"],
  TACTICAL: [SQ.blue, "rgba(59,111,212,.45)"],
  SPORTS: [SQ.green, "rgba(31,157,99,.45)"],
  FIGHTING: [SQ.amber, "rgba(181,131,26,.5)"],
  PARTY: [SQ.mute, SQ.inputBorder],
};

export function GamesScreen() {
  const { data, isLoading, isError } = useGames();
  const updateGame = useUpdateGame();
  const seasonQ = useCurrentSeason();
  const seasonActive = !!seasonQ.data;
  const games = data ?? [];

  return (
    <div>
      <ScreenHeader eyebrow="Title settings" title="GAMES" />
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".1em",
          color: SQ.mute,
          margin: "12px 0 24px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        SUPPORTED TITLES{seasonActive ? " · LOCKED WHILE A SEASON IS RUNNING" : " · ENABLE OR HIDE BETWEEN SEASONS"}
      </div>

      {isLoading ? (
        <StateNote>Loading games…</StateNote>
      ) : games.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load games (admin sign-in required)." : "No games yet."}
        </StateNote>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
            gap: 16,
          }}
        >
          {games.map((g) => {
            const [typeColor, typeBorder] = GAME_TYPE_COLORS[g.gameType];
            return (
            <div
              key={g.id}
              style={{
                background: SQ.panel,
                border: `1px solid ${SQ.hairline}`,
                borderRadius: 9,
                padding: "18px 20px",
                opacity: g.enabled ? 1 : 0.7,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT.display, fontSize: 18, letterSpacing: "-.02em" }}>
                    {g.name}
                  </div>
                  <span style={{ ...typeBadge, color: typeColor, border: `1px solid ${typeBorder}` }}>
                    {GAME_TYPE_LABEL[g.gameType]}
                  </span>
                </div>
                <Toggle
                  on={g.enabled}
                  disabled={updateGame.isPending || seasonActive}
                  onToggle={() =>
                    seasonActive
                      ? undefined
                      : updateGame.mutate({ id: g.id, body: { enabled: !g.enabled } })
                  }
                />
              </div>
              <div style={{ display: "flex", gap: 18, marginTop: 14, alignItems: "flex-end" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={statLabel}>FORMAT</div>
                  <input
                    defaultValue={g.format}
                    disabled={updateGame.isPending || seasonActive}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      // FORMAT is NOT NULL — refuse blank, and only PATCH when it actually changed.
                      if (!v) {
                        e.target.value = g.format;
                      } else if (!seasonActive && v !== g.format) {
                        updateGame.mutate({ id: g.id, body: { format: v } });
                      }
                    }}
                    style={{
                      marginTop: 4,
                      width: "100%",
                      maxWidth: 200,
                      background: SQ.inset,
                      border: `1px solid ${SQ.inputBorder}`,
                      borderRadius: 5,
                      padding: "6px 9px",
                      fontFamily: FONT.mono,
                      fontSize: 12.5,
                      color: SQ.ink,
                      cursor: updateGame.isPending || seasonActive ? "default" : "text",
                      opacity: updateGame.isPending || seasonActive ? 0.5 : 1,
                    }}
                  />
                </div>
                <div>
                  <div style={statLabel}>POPULARITY</div>
                  <div style={{ ...statValue, color: SQ.faint }}>{g.popularity}/100</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={statLabel}>VISIBILITY</div>
                  <div style={{ ...statValue, color: g.enabled ? SQ.green : SQ.mute }}>
                    {g.enabled ? "Live" : "Hidden"}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={statLabel}>GAME TYPE</div>
                <select
                  value={g.gameType}
                  disabled={updateGame.isPending || seasonActive}
                  onChange={(e) =>
                    seasonActive
                      ? undefined
                      : updateGame.mutate({
                          id: g.id,
                          body: { gameType: e.target.value as GameType },
                        })
                  }
                  style={{
                    ...typeSelect,
                    cursor: updateGame.isPending || seasonActive ? "default" : "pointer",
                    opacity: updateGame.isPending || seasonActive ? 0.5 : 1,
                  }}
                >
                  {(Object.keys(GAME_TYPE_LABEL) as GameType[]).map((t) => (
                    <option key={t} value={t}>
                      {GAME_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
