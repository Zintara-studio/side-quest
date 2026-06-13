import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";
import { players, sortChips } from "@/lib/mock/league";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

export function PlayersScreen() {
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
          486 REGISTERED · SEASON 04
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            <div style={{ width: 140 }}>FRANCHISE</div>
            <div style={{ width: 70, textAlign: "right" }}>PLAYED</div>
            <div style={{ width: 70, textAlign: "right" }}>POINTS</div>
            <div style={{ width: 120, textAlign: "right" }}>GAMES</div>
          </div>
          {players.map((p, i) => (
            <Link
              key={p.rank}
              href="/player"
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
              <div style={{ width: 140, fontFamily: FONT.mono, fontSize: 12, color: SQ.faint }}>
                {p.fr}
              </div>
              <div
                style={{
                  width: 70,
                  textAlign: "right",
                  fontFamily: FONT.mono,
                  fontSize: 13,
                  color: SQ.faint,
                }}
              >
                {p.gp}
              </div>
              <div
                style={{ width: 70, textAlign: "right", fontFamily: FONT.display, fontSize: 16 }}
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
    </div>
  );
}
