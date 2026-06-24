"use client";

import Link from "next/link";
import { SQ, FONT, rankAccent } from "../tokens";
import { StateNote } from "../state-note";
import { useMatch, useMatchLeaderboard, useMatchRounds } from "@/lib/query/hooks";
import { shortDate } from "@/lib/adapters/league";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

export function MatchScreen({ id, base = "" }: { id?: string; base?: string }) {
  const mq = useMatch(id);
  const lbQ = useMatchLeaderboard(id);
  const roundsQ = useMatchRounds(id);
  const m = mq.data;
  const rounds = roundsQ.data ?? [];

  return (
    <div>
      <Link
        href={base ? `${base}/matches` : "/"}
        style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".14em", color: SQ.mute, textDecoration: "none" }}
      >
        ◂ {base ? "MATCHES" : "MATCHDAY"}
      </Link>

      {!id ? (
        <div style={{ marginTop: 20 }}>
          <StateNote>Select a match from the schedule or a franchise/player page.</StateNote>
        </div>
      ) : mq.isLoading ? (
        <div style={{ marginTop: 20 }}>
          <StateNote>Loading match…</StateNote>
        </div>
      ) : !m ? (
        <div style={{ marginTop: 20 }}>
          <StateNote tone="error">Couldn't load this match.</StateNote>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginTop: 14,
              paddingBottom: 24,
              borderBottom: `1px solid ${SQ.hairline}`,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  letterSpacing: ".22em",
                  textTransform: "uppercase",
                  color: SQ.red,
                }}
              >
                {m.game?.name ?? "Match"} · {m.format ?? ""}
              </div>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: "clamp(34px,5vw,60px)",
                  lineHeight: 0.92,
                  letterSpacing: "-.03em",
                  marginTop: 12,
                }}
              >
                {m.game?.name?.toUpperCase() ?? "MATCH"}
              </div>
              <div
                style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute, marginTop: 14 }}
              >
                {[m.arena, shortDate(m.scheduledAt), m.format].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".16em",
                color: m.status === "LIVE" ? SQ.ember : SQ.mute,
                border: `1px solid ${m.status === "LIVE" ? "rgba(232,96,44,.45)" : SQ.inputBorder}`,
                padding: "8px 14px",
                borderRadius: 4,
              }}
            >
              {m.status}
            </div>
          </div>

          {/* participants */}
          {m.participants.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
              {m.participants.map((p) => (
                <Link
                  key={p.franchiseId}
                  href={`${base}/franchise/${p.franchiseId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: `1px solid ${SQ.hairline}`,
                    background: SQ.panel,
                    textDecoration: "none",
                    color: SQ.ink,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                  {p.tag ? (
                    <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute }}>{p.tag}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : null}

          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              margin: "34px 0 14px",
            }}
          >
            Match Leaderboard
          </div>

          {!m.hasResults ? (
            <StateNote>Results are pending — check back after the match.</StateNote>
          ) : lbQ.isLoading ? (
            <StateNote>Loading results…</StateNote>
          ) : (lbQ.data ?? []).length === 0 ? (
            <StateNote>No results recorded.</StateNote>
          ) : (
            <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
              <div style={{ minWidth: 560 }}>
                <div
                  style={{
                    display: "flex",
                    padding: "14px 18px",
                    borderBottom: `1px solid ${SQ.hairline}`,
                    ...headCell,
                  }}
                >
                  <div style={{ width: 44 }}>#</div>
                  <div style={{ flex: 1 }}>FRANCHISE</div>
                  <div style={{ width: 80, textAlign: "right" }}>KILLS</div>
                  <div style={{ width: 90, textAlign: "right" }}>PLACE PTS</div>
                  <div style={{ width: 80, textAlign: "right" }}>TOTAL</div>
                </div>
                {(lbQ.data ?? []).map((r) => {
                  const accent = rankAccent(r.rank === 1);
                  return (
                    <Link
                      key={r.franchiseId}
                      href={`${base}/franchise/${r.franchiseId}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "14px 18px",
                        borderBottom: `1px solid ${SQ.hairlineSoft}`,
                        background: accent.rowBg,
                        textDecoration: "none",
                        color: SQ.ink,
                      }}
                    >
                      <div style={{ width: 44, fontFamily: FONT.display, fontSize: 17, color: accent.color }}>
                        {String(r.rank).padStart(2, "0")}
                      </div>
                      <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                        {r.franchiseName}
                        {r.franchiseTag ? (
                          <span
                            style={{
                              fontFamily: FONT.mono,
                              fontSize: 10,
                              color: SQ.mute,
                              fontWeight: 400,
                              marginLeft: 6,
                            }}
                          >
                            {r.franchiseTag}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ width: 80, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}>
                        {r.kills}
                      </div>
                      <div style={{ width: 90, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}>
                        +{r.placePts}
                      </div>
                      <div style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 17 }}>
                        {r.total}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {rounds.length > 0 ? (
            <>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                  margin: "34px 0 14px",
                }}
              >
                Per-Round Results
              </div>
              {rounds.map((rd) => (
                <div key={rd.roundNumber} style={{ marginBottom: 18 }}>
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      letterSpacing: ".14em",
                      color: SQ.ember,
                      marginBottom: 8,
                    }}
                  >
                    ROUND {rd.roundNumber}
                    {rd.mapName ? ` · ${rd.mapName}` : ""}
                    {rd.mode ? ` · ${rd.mode}` : ""}
                  </div>
                  <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
                    <div style={{ minWidth: 520 }}>
                      <div
                        style={{
                          display: "flex",
                          padding: "12px 16px",
                          borderBottom: `1px solid ${SQ.hairline}`,
                          ...headCell,
                        }}
                      >
                        <div style={{ width: 36 }}>#</div>
                        <div style={{ flex: 1 }}>FRANCHISE</div>
                        <div style={{ width: 70, textAlign: "right" }}>KILLS</div>
                        <div style={{ width: 90, textAlign: "right" }}>SURVIVAL</div>
                        <div style={{ width: 90, textAlign: "right" }}>PLACE PTS</div>
                      </div>
                      {rd.rows.map((x) => (
                        <div
                          key={x.franchiseId}
                          style={{ borderBottom: `1px solid ${SQ.hairlineSoft}` }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "11px 16px",
                            }}
                          >
                            <div
                              style={{
                                width: 36,
                                fontFamily: FONT.display,
                                fontSize: 15,
                                color: x.rank === 1 ? SQ.red : SQ.steel,
                              }}
                            >
                              {x.rank}
                            </div>
                            <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                              {x.franchiseName}
                              {x.franchiseTag ? (
                                <span
                                  style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, marginLeft: 6 }}
                                >
                                  {x.franchiseTag}
                                </span>
                              ) : null}
                            </div>
                            <div
                              style={{ width: 70, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}
                            >
                              {x.kills}
                            </div>
                            <div
                              style={{ width: 90, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}
                            >
                              {Math.round(x.survivalSeconds / 60)}m
                            </div>
                            <div
                              style={{ width: 90, textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}
                            >
                              +{x.placePts}
                            </div>
                          </div>
                          {x.players && x.players.length > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                padding: "0 16px 12px 52px",
                              }}
                            >
                              {x.players.map((pl) => (
                                <span
                                  key={pl.playerId}
                                  style={{
                                    fontFamily: FONT.mono,
                                    fontSize: 10.5,
                                    color: SQ.mute,
                                    border: `1px solid ${SQ.hairline}`,
                                    borderRadius: 5,
                                    padding: "3px 7px",
                                  }}
                                >
                                  {pl.gamerTag} · {pl.kills}k
                                  {pl.survivalSeconds > 0 ? ` · ${Math.round(pl.survivalSeconds / 60)}m` : ""}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
