"use client";

import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { Toggle } from "../toggle";
import { StateNote } from "@/components/sidequest/state-note";
import { useGames, useUpdateGame, useCurrentSeason } from "@/lib/query/hooks";

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
          {games.map((g) => (
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: FONT.display, fontSize: 18, letterSpacing: "-.02em" }}>
                  {g.name}
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
                <div>
                  <div style={statLabel}>FORMAT</div>
                  <div style={{ ...statValue, color: SQ.faint }}>{g.format}</div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
