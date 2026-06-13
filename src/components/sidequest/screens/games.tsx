import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";
import { games } from "@/lib/mock/league";

const bannerHatch =
  "repeating-linear-gradient(45deg,#1d2026,#1d2026 12px,#222630 12px,#222630 24px)";

const statLabel = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".1em",
  color: SQ.label,
} as const;

export function GamesScreen() {
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
        6 TITLES · SEASON 04 · LIVE POPULARITY INDEX
      </div>

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
            href="/league/match"
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
                borderBottom: "1px solid rgba(255,255,255,.08)",
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
                  background: "rgba(255,255,255,.08)",
                  borderRadius: 3,
                  marginTop: 8,
                  overflow: "hidden",
                }}
              >
                <div style={{ height: "100%", width: `${g.pop}%`, background: SQ.red }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
                <div>
                  <div style={statLabel}>PLAYERS</div>
                  <div style={{ fontFamily: FONT.display, fontSize: 22, marginTop: 3 }}>
                    {g.players}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={statLabel}>NEXT MATCHDAY</div>
                  <div style={{ fontFamily: FONT.display, fontSize: 22, marginTop: 3 }}>{g.next}</div>
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
    </div>
  );
}
