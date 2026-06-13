import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { franchiseStats, roster, franchiseGames } from "@/lib/mock/league";

const sectionLabel = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  marginBottom: 14,
} as const;

export function FranchiseScreen() {
  return (
    <div>
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
        ◂ FRANCHISES
      </Link>

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
            Rank 01 · 224 points
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
            RXG — RAGING X
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
            IGL RAGHAVAN · 5 PLAYERS · 18 MATCHES
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
          01
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
        {franchiseStats.map((s) => (
          <div
            key={s.label}
            style={{
              padding: "18px 22px",
              borderRight: `1px solid ${SQ.hairlineCell}`,
              borderBottom: `1px solid ${SQ.hairlineCell}`,
            }}
          >
            <div
              style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".12em", color: SQ.label }}
            >
              {s.label}
            </div>
            <div
              style={{ fontFamily: FONT.display, fontSize: 30, letterSpacing: "-.02em", marginTop: 5 }}
            >
              {s.value}
            </div>
          </div>
        ))}
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
          {roster.map((p) => (
            <Link
              key={p.name}
              href="/player"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "13px 0",
                borderTop: `1px solid ${SQ.hairlineCell}`,
                cursor: "pointer",
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
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.name}</div>
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      letterSpacing: ".1em",
                      color: SQ.mute,
                      marginTop: 2,
                    }}
                  >
                    {p.role}
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: FONT.display, fontSize: 16 }}>{p.pts}</div>
            </Link>
          ))}
        </div>

        {/* games played */}
        <div>
          <div style={sectionLabel}>Games Played</div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 360 }}>
              {franchiseGames.map((g) => (
                <Link
                  key={g.match}
                  href="/match"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "13px 0",
                    borderTop: `1px solid ${SQ.hairlineCell}`,
                    cursor: "pointer",
                    textDecoration: "none",
                    color: SQ.ink,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{g.match}</div>
                    <div
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        letterSpacing: ".1em",
                        color: SQ.mute,
                        marginTop: 2,
                      }}
                    >
                      {g.players}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", display: "flex", gap: 18, alignItems: "center" }}>
                    <div style={{ fontFamily: FONT.mono, fontSize: 13, color: SQ.green }}>{g.pts}</div>
                    <div
                      style={{
                        fontFamily: FONT.display,
                        fontSize: 16,
                        width: 42,
                        textAlign: "right",
                      }}
                    >
                      {g.rank}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
