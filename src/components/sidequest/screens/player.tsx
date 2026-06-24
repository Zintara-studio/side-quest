"use client";

import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { StateNote } from "../state-note";
import { usePlayer, usePlayerMatches, usePlayerUsernames } from "@/lib/query/hooks";
import { shortDate } from "@/lib/adapters/league";

const sectionLabel = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  marginBottom: 14,
} as const;

const tile = {
  padding: "18px 22px",
  borderRight: `1px solid ${SQ.hairlineCell}`,
  borderBottom: `1px solid ${SQ.hairlineCell}`,
} as const;
const tileLabel = { fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".12em", color: SQ.label } as const;
const tileValue = { fontFamily: FONT.display, fontSize: 30, letterSpacing: "-.02em", marginTop: 5 } as const;

export function PlayerScreen({ id, base = "" }: { id?: string; base?: string }) {
  const pq = usePlayer(id);
  const matchesQ = usePlayerMatches(id);
  const usernamesQ = usePlayerUsernames(id);
  const p = pq.data;

  return (
    <div>
      <Link
        href={`${base}/players`}
        style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".14em", color: SQ.mute, textDecoration: "none" }}
      >
        ◂ PLAYERS
      </Link>

      {!id ? (
        <div style={{ marginTop: 20 }}>
          <StateNote>Select a player from the directory.</StateNote>
        </div>
      ) : pq.isLoading ? (
        <div style={{ marginTop: 20 }}>
          <StateNote>Loading player…</StateNote>
        </div>
      ) : !p ? (
        <div style={{ marginTop: 20 }}>
          <StateNote tone="error">Couldn't load this player.</StateNote>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 22,
              alignItems: "center",
              marginTop: 16,
              paddingBottom: 26,
              borderBottom: `1px solid ${SQ.hairline}`,
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: SQ.avatarGrad,
                border: `1px solid ${SQ.inputBorder}`,
              }}
            />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".16em", color: SQ.red }}>
                {p.franchise ? `${p.franchise.tag} · ` : ""}
                {p.status}
              </div>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: "clamp(38px,5.5vw,60px)",
                  lineHeight: 0.92,
                  letterSpacing: "-.03em",
                  marginTop: 8,
                }}
              >
                {p.gamerTag}
              </div>
              <div
                style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute, marginTop: 10 }}
              >
                {p.user?.name ?? p.gamerTag}
                {p.region ? ` · ${p.region}` : ""}
              </div>
              {p.bio ? (
                <div style={{ fontSize: 13.5, color: SQ.faint, marginTop: 10, lineHeight: 1.6, maxWidth: 560 }}>
                  {p.bio}
                </div>
              ) : null}
            </div>
            {p.franchise ? (
              <Link
                href={`${base}/franchise/${p.franchise.id}`}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: SQ.ink,
                  border: `1px solid ${SQ.inputBorder}`,
                  padding: "11px 16px",
                  borderRadius: 5,
                  textDecoration: "none",
                }}
              >
                View franchise ▸
              </Link>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
              border: `1px solid ${SQ.hairline}`,
              borderRadius: 8,
              overflow: "hidden",
              marginTop: 26,
            }}
          >
            <div style={tile}>
              <div style={tileLabel}>POINTS</div>
              <div style={tileValue}>{p.points}</div>
            </div>
            <div style={tile}>
              <div style={tileLabel}>MATCHES</div>
              <div style={tileValue}>{(matchesQ.data ?? []).length}</div>
            </div>
            <div style={tile}>
              <div style={tileLabel}>GAMES</div>
              <div style={tileValue}>{p.proficiencies.length}</div>
            </div>
            <div style={tile}>
              <div style={tileLabel}>STATUS</div>
              <div style={{ ...tileValue, fontSize: 22, marginTop: 9 }}>{p.status}</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
              gap: 28,
              marginTop: 30,
            }}
          >
            {/* usernames + proficiencies */}
            <div>
              <div style={sectionLabel}>Game Usernames</div>
              {(usernamesQ.data ?? []).length === 0 ? (
                <StateNote>No public game handles.</StateNote>
              ) : (
                (usernamesQ.data ?? []).map((u) => (
                  <div
                    key={`${u.gameId}-${u.handle}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "13px 0",
                      borderTop: `1px solid ${SQ.hairlineCell}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{u.handle}</div>
                      <div
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10,
                          letterSpacing: ".1em",
                          color: SQ.mute,
                          marginTop: 2,
                        }}
                      >
                        {u.gameName}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        letterSpacing: ".1em",
                        color: u.isPublic ? SQ.green : SQ.mute,
                        border: `1px solid ${u.isPublic ? "rgba(31,157,99,.45)" : SQ.inputBorder}`,
                        padding: "5px 9px",
                        borderRadius: 4,
                      }}
                    >
                      {u.isPublic ? "PUBLIC" : "PRIVATE"}
                    </div>
                  </div>
                ))
              )}

              {p.proficiencies.length > 0 ? (
                <>
                  <div style={{ ...sectionLabel, margin: "26px 0 14px" }}>Proficiency</div>
                  {p.proficiencies.map((pr) => (
                    <div
                      key={pr.gameId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "11px 0",
                        borderTop: `1px solid ${SQ.hairlineCell}`,
                      }}
                    >
                      <span style={{ fontSize: 13.5 }}>{pr.gameName}</span>
                      <span style={{ fontFamily: FONT.display, fontSize: 16 }}>{pr.rating}</span>
                    </div>
                  ))}
                </>
              ) : null}
            </div>

            {/* past matches */}
            <div>
              <div style={sectionLabel}>Match History</div>
              {matchesQ.isLoading ? (
                <StateNote>Loading matches…</StateNote>
              ) : (matchesQ.data ?? []).length === 0 ? (
                <StateNote>No matches yet.</StateNote>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 340 }}>
                    {(matchesQ.data ?? []).map((m) => (
                      <Link
                        key={m.matchId}
                        href={`${base}/match/${m.matchId}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "13px 0",
                          borderTop: `1px solid ${SQ.hairlineCell}`,
                          textDecoration: "none",
                          color: SQ.ink,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{m.gameName}</div>
                          <div
                            style={{
                              fontFamily: FONT.mono,
                              fontSize: 10,
                              letterSpacing: ".1em",
                              color: SQ.mute,
                              marginTop: 2,
                            }}
                          >
                            {shortDate(m.scheduledAt)} · {m.status}
                          </div>
                        </div>
                        <div style={{ fontFamily: FONT.display, fontSize: 18 }}>
                          {m.franchiseRank != null ? `#${m.franchiseRank}` : "—"}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
