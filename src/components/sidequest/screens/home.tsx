"use client";

import { useMemo } from "react";
import Link from "next/link";
import { SQ, FONT, rankAccent } from "../tokens";
import { StateNote } from "../state-note";
import { useStandings, useMatches, usePlayers, useCurrentSeason } from "@/lib/query/hooks";
import { adaptUpcoming } from "@/lib/adapters/league";

const sectionLabel = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".2em",
  textTransform: "uppercase",
} as const;

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

export function HomeScreen() {
  const standingsQ = useStandings();
  const matchesQ = useMatches({ status: "SCHEDULED", limit: 6 });
  const playersQ = usePlayers({ limit: 100 });
  const season = useCurrentSeason().data;

  const upcoming = matchesQ.data ? adaptUpcoming(matchesQ.data.items) : [];
  const rows = standingsQ.data?.standings ?? [];

  // Best player per franchise = highest-points player in that franchise (real data).
  const bestByFranchise = useMemo(() => {
    const name: Record<string, string> = {};
    const top: Record<string, number> = {};
    for (const p of playersQ.data?.items ?? []) {
      const key = (p.franchiseName ?? "").toLowerCase();
      if (!key) continue;
      if (top[key] === undefined || p.points > top[key]) {
        top[key] = p.points;
        name[key] = p.gamerTag;
      }
    }
    return name;
  }, [playersQ.data]);

  return (
    <div>
      {/* hero */}
      <div
        style={{
          paddingBottom: 26,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: SQ.red,
          }}
        >
          {season ? `${season.code} — ${season.name}` : "Community Esports League"}
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: "clamp(40px,6vw,72px)",
            lineHeight: 0.9,
            letterSpacing: "-.03em",
            marginTop: 14,
          }}
        >
          MATCHDAY
          <br />& STANDINGS
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: ".1em",
            color: SQ.mute,
            marginTop: 16,
          }}
        >
          {upcoming.length} UPCOMING · {rows.length} FRANCHISES
        </div>
      </div>

      {/* upcoming matches */}
      <div style={{ ...sectionLabel, margin: "30px 0 16px" }}>Upcoming Matches</div>
      {matchesQ.isLoading ? (
        <StateNote>Loading fixtures…</StateNote>
      ) : upcoming.length === 0 ? (
        <StateNote tone={matchesQ.isError ? "error" : "muted"}>
          {matchesQ.isError ? "Couldn't reach the league API." : "No upcoming matches scheduled."}
        </StateNote>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
            gap: 16,
          }}
        >
          {upcoming.map((u, i) => (
            <Link
              key={u.id}
              href={`/match/${u.id}`}
              style={{
                background: SQ.panel,
                border: `1px solid ${SQ.hairline}`,
                borderRadius: 8,
                padding: "18px 20px",
                textDecoration: "none",
                color: SQ.ink,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10.5,
                    letterSpacing: ".12em",
                    color: SQ.ember,
                  }}
                >
                  {u.meta}
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute }}>
                  {u.day} {u.mon}
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 14 }}>{u.title}</div>
            </Link>
          ))}
        </div>
      )}

      {/* franchise leaderboard */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "34px 0 16px",
        }}
      >
        <div style={sectionLabel}>Franchise Leaderboard</div>
        <Link
          href="/franchises"
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".14em",
            color: SQ.mute,
            textDecoration: "none",
          }}
        >
          VIEW ALL ▸
        </Link>
      </div>

      {standingsQ.isLoading ? (
        <StateNote>Loading standings…</StateNote>
      ) : rows.length === 0 ? (
        <StateNote tone={standingsQ.isError ? "error" : "muted"}>
          {standingsQ.isError ? "Couldn't reach the league API." : "No standings yet."}
        </StateNote>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
          <div style={{ minWidth: 520 }}>
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
              <div style={{ width: 80, textAlign: "right" }}>PTS</div>
              <div style={{ width: 180, textAlign: "right" }}>BEST PLAYER</div>
            </div>
            {rows.map((r) => {
              const accent = rankAccent(r.rank === 1);
              const best = bestByFranchise[(r.name ?? "").toLowerCase()];
              return (
                <Link
                  key={r.franchiseId}
                  href={`/franchise/${r.franchiseId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "13px 18px",
                    borderBottom: `1px solid ${SQ.hairlineSoft}`,
                    cursor: "pointer",
                    background: accent.rowBg,
                    textDecoration: "none",
                    color: SQ.ink,
                  }}
                >
                  <div
                    style={{ width: 44, fontFamily: FONT.display, fontSize: 18, color: accent.color }}
                  >
                    {String(r.rank).padStart(2, "0")}
                  </div>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                    {r.name}
                    {r.tag ? (
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10,
                          color: SQ.mute,
                          fontWeight: 400,
                          marginLeft: 6,
                        }}
                      >
                        {r.tag}
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 18 }}
                  >
                    {r.points}
                  </div>
                  <div style={{ width: 180, textAlign: "right", fontSize: 13, color: SQ.faint }}>
                    {best ?? "—"}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
