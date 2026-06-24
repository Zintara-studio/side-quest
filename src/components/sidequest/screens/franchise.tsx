"use client";

import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { StateNote } from "../state-note";
import { useFranchise, useFranchiseRoster, useFranchiseMatches } from "@/lib/query/hooks";
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

export function FranchiseScreen({ id, base = "" }: { id?: string; base?: string }) {
  const fq = useFranchise(id);
  const rosterQ = useFranchiseRoster(id);
  const matchesQ = useFranchiseMatches(id);
  const f = fq.data;

  return (
    <div>
      <Link
        href={`${base}/franchises`}
        style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".14em", color: SQ.mute, textDecoration: "none" }}
      >
        ◂ FRANCHISES
      </Link>

      {!id ? (
        <div style={{ marginTop: 20 }}>
          <StateNote>Select a franchise from the league table.</StateNote>
        </div>
      ) : fq.isLoading ? (
        <div style={{ marginTop: 20 }}>
          <StateNote>Loading franchise…</StateNote>
        </div>
      ) : !f ? (
        <div style={{ marginTop: 20 }}>
          <StateNote tone="error">Couldn't load this franchise.</StateNote>
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
              marginTop: 16,
              paddingBottom: 26,
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
                Rank {String(f.rank).padStart(2, "0")} · {f.points} points
              </div>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: "clamp(38px,5.5vw,64px)",
                  lineHeight: 0.92,
                  letterSpacing: "-.03em",
                  marginTop: 10,
                }}
              >
                {f.name}
                {f.tag ? <span style={{ color: SQ.mute }}> — {f.tag}</span> : null}
              </div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  letterSpacing: ".1em",
                  color: SQ.mute,
                  marginTop: 12,
                }}
              >
                {f.igl ? `IGL ${f.igl.gamerTag} · ` : ""}
                {f.rosterSize} PLAYERS · {f.matchesPlayed} MATCHES · {f.active ? "ACTIVE" : "INACTIVE"}
              </div>
            </div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: "clamp(48px,8vw,84px)",
                color: SQ.red,
                letterSpacing: "-.03em",
                lineHeight: 0.8,
              }}
            >
              {String(f.rank).padStart(2, "0")}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              border: `1px solid ${SQ.hairline}`,
              borderRadius: 8,
              overflow: "hidden",
              marginTop: 26,
            }}
          >
            <div style={tile}>
              <div style={tileLabel}>POINTS</div>
              <div style={tileValue}>{f.points}</div>
            </div>
            <div style={tile}>
              <div style={tileLabel}>RANK</div>
              <div style={tileValue}>#{f.rank}</div>
            </div>
            <div style={tile}>
              <div style={tileLabel}>ROSTER</div>
              <div style={tileValue}>{f.rosterSize}</div>
            </div>
            <div style={tile}>
              <div style={tileLabel}>MATCHES</div>
              <div style={tileValue}>{f.matchesPlayed}</div>
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
            {/* roster */}
            <div>
              <div style={sectionLabel}>Roster</div>
              {rosterQ.isLoading ? (
                <StateNote>Loading roster…</StateNote>
              ) : (rosterQ.data ?? []).length === 0 ? (
                <StateNote>No players on this roster yet.</StateNote>
              ) : (
                (rosterQ.data ?? []).map((p) => (
                  <Link
                    key={p.playerId}
                    href={`${base}/player/${p.playerId}`}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: SQ.avatar,
                          border: `1px solid ${SQ.avatarBorder}`,
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.gamerTag}</div>
                        <div
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: 10,
                            letterSpacing: ".1em",
                            color: SQ.mute,
                            marginTop: 2,
                          }}
                        >
                          {p.isIgl ? "IGL" : p.status}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.dim }}>▸</div>
                  </Link>
                ))
              )}
            </div>

            {/* matches */}
            <div>
              <div style={sectionLabel}>Matches</div>
              {matchesQ.isLoading ? (
                <StateNote>Loading matches…</StateNote>
              ) : (matchesQ.data ?? []).length === 0 ? (
                <StateNote>No matches played yet.</StateNote>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 340 }}>
                    {(matchesQ.data ?? []).map((g) => (
                      <Link
                        key={g.matchId}
                        href={`${base}/match/${g.matchId}`}
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
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{g.gameName}</div>
                          <div
                            style={{
                              fontFamily: FONT.mono,
                              fontSize: 10,
                              letterSpacing: ".1em",
                              color: SQ.mute,
                              marginTop: 2,
                            }}
                          >
                            {shortDate(g.scheduledAt)} · {g.status}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", display: "flex", gap: 18, alignItems: "center" }}>
                          {g.total != null ? (
                            <div style={{ fontFamily: FONT.mono, fontSize: 13, color: SQ.green }}>
                              +{g.total}
                            </div>
                          ) : null}
                          <div style={{ fontFamily: FONT.display, fontSize: 16, width: 42, textAlign: "right" }}>
                            {g.rank != null ? `#${g.rank}` : "—"}
                          </div>
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
