import Link from "next/link";
import { SQ, FONT, rankAccent } from "../tokens";
import { rosterA, rosterB, resultRows } from "@/lib/mock/league";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

function TeamCard({
  name,
  nameColor,
  score,
  scoreColor,
  sub,
  roster,
}: {
  name: string;
  nameColor: string;
  score: string;
  scoreColor: string;
  sub: string;
  roster: { name: string; kd: string }[];
}) {
  return (
    <div
      style={{
        background: SQ.panel,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 8,
        padding: 22,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: FONT.display, fontSize: 26, letterSpacing: "-.02em", color: nameColor }}>
          {name}
        </div>
        <div style={{ fontFamily: FONT.display, fontSize: 34, color: scoreColor }}>{score}</div>
      </div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: ".12em",
          color: SQ.mute,
          margin: "4px 0 16px",
        }}
      >
        {sub}
      </div>
      {roster.map((p) => (
        <Link
          key={p.name}
          href="/player"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 0",
            borderTop: `1px solid ${SQ.hairlineFaint}`,
            cursor: "pointer",
            textDecoration: "none",
            color: SQ.ink,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: SQ.avatar,
                border: `1px solid ${SQ.avatarBorder}`,
              }}
            />
            <span style={{ fontSize: 14 }}>{p.name}</span>
          </div>
          <span style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.faint }}>{p.kd}</span>
        </Link>
      ))}
    </div>
  );
}

export function MatchScreen() {
  return (
    <div>
      <Link
        href="/"
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: ".14em",
          color: SQ.mute,
          textDecoration: "none",
        }}
      >
        ◂ MATCHDAY
      </Link>

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
            Valorant · Matchday 18
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: "clamp(38px,5.5vw,64px)",
              lineHeight: 0.92,
              letterSpacing: "-.03em",
              marginTop: 12,
            }}
          >
            VALO MATCH 1
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".1em",
              color: SQ.mute,
              marginTop: 14,
            }}
          >
            ARENA 1 · 22 APR 18:30 · BEST OF 3
          </div>
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".16em",
            color: SQ.ember,
            border: "1px solid rgba(255,61,46,.4)",
            padding: "8px 14px",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: SQ.red,
              animation: "sqpulse 1.4s infinite",
            }}
          />
          LIVE · MAP 2
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 20,
          marginTop: 28,
        }}
      >
        <TeamCard
          name="RXG"
          nameColor={SQ.ink}
          score="13"
          scoreColor={SQ.red}
          sub="RAGING X · FRANCHISE"
          roster={rosterA}
        />
        <TeamCard
          name="NIGHTFALL"
          nameColor={SQ.faint}
          score="9"
          scoreColor={SQ.slate}
          sub="FRANCHISE"
          roster={rosterB}
        />
      </div>

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".2em",
          textTransform: "uppercase",
          margin: "34px 0 14px",
        }}
      >
        Match Leaderboard — All Squads
      </div>
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
            <div style={{ flex: 1 }}>SQUAD</div>
            <div style={{ width: 80, textAlign: "right" }}>KILLS</div>
            <div style={{ width: 90, textAlign: "right" }}>PLACE PTS</div>
            <div style={{ width: 80, textAlign: "right" }}>TOTAL</div>
          </div>
          {resultRows.map((r) => {
            const accent = rankAccent(r.rank === "01");
            return (
              <div
                key={r.rank}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 18px",
                  borderBottom: `1px solid ${SQ.hairlineSoft}`,
                  background: accent.rowBg,
                }}
              >
                <div
                  style={{ width: 44, fontFamily: FONT.display, fontSize: 17, color: accent.color }}
                >
                  {r.rank}
                </div>
                <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{r.team}</div>
                <div
                  style={{
                    width: 80,
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    fontSize: 13,
                    color: SQ.faint,
                  }}
                >
                  {r.kills}
                </div>
                <div
                  style={{
                    width: 90,
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    fontSize: 13,
                    color: SQ.faint,
                  }}
                >
                  {r.place}
                </div>
                <div
                  style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 17 }}
                >
                  {r.total}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
