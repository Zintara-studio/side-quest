import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { playerStats, usernames, playerMatches } from "@/lib/mock/league";

const sectionLabel = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  marginBottom: 14,
} as const;

export function PlayerScreen() {
  return (
    <div>
      <Link
        href="/league/players"
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: ".14em",
          color: SQ.mute,
          textDecoration: "none",
        }}
      >
        ◂ PLAYERS
      </Link>

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
            background: "linear-gradient(135deg,#3a3d46,#1c1e24)",
            border: `1px solid ${SQ.inputBorder}`,
          }}
        />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".16em", color: SQ.red }}
          >
            RXG · IGL · MVP S04
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
            RAGHAVAN
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".1em",
              color: SQ.mute,
              marginTop: 10,
            }}
          >
            @raghavan · JOINED SEASON 02
          </div>
        </div>
        <Link
          href="/league/franchise"
          style={{
            cursor: "pointer",
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: SQ.ink,
            border: "1px solid rgba(255,255,255,.2)",
            padding: "11px 16px",
            borderRadius: 5,
            textDecoration: "none",
          }}
        >
          View franchise ▸
        </Link>
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
        {playerStats.map((s) => (
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
        {/* usernames */}
        <div>
          <div style={sectionLabel}>Game Usernames</div>
          {usernames.map((u) => {
            const isPublic = u.vis === "PUBLIC";
            return (
              <div
                key={u.handle}
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
                    {u.game}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: ".1em",
                    color: isPublic ? SQ.green : SQ.mute,
                    border: `1px solid ${isPublic ? "rgba(63,207,142,.4)" : SQ.inputBorder}`,
                    padding: "5px 9px",
                    borderRadius: 4,
                  }}
                >
                  {u.vis}
                </div>
              </div>
            );
          })}
        </div>

        {/* past matches */}
        <div>
          <div style={sectionLabel}>Past Matches</div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 340 }}>
              {playerMatches.map((m) => (
                <Link
                  key={m.match}
                  href="/league/match"
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
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.match}</div>
                    <div
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        letterSpacing: ".1em",
                        color: SQ.mute,
                        marginTop: 2,
                      }}
                    >
                      {m.date} · {m.kills} KILLS
                    </div>
                  </div>
                  <div style={{ fontFamily: FONT.display, fontSize: 18, color: m.rankColor }}>
                    {m.rank}
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
