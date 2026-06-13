import Link from "next/link";
import { SQ, FONT, rankAccent } from "../tokens";
import {
  statTiles,
  standingsTop,
  upcoming,
  announceShort,
} from "@/lib/mock/league";

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
  return (
    <div>
      {/* hero */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "flex-end",
          justifyContent: "space-between",
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
            Season 04 — Spring Series
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
            STANDINGS
            <br />& MATCHDAY
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
            12 FRANCHISES · 6 TITLES · 94 MATCHES PLAYED
          </div>
        </div>

        {/* live match card */}
        <Link
          href="/match"
          style={{
            cursor: "pointer",
            width: "min(420px,100%)",
            flex: 1,
            minWidth: 300,
            background: "linear-gradient(180deg,rgba(255,61,46,.12),rgba(255,61,46,0))",
            border: "1px solid rgba(255,61,46,.3)",
            borderRadius: 8,
            padding: "22px 24px",
            textDecoration: "none",
            color: SQ.ink,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".18em",
                color: SQ.ember,
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
              LIVE NOW
            </div>
            <div
              style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".14em", color: SQ.mute }}
            >
              VALORANT · BO3
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              margin: "18px 0",
            }}
          >
            <div>
              <div style={{ fontFamily: FONT.display, fontSize: 30, letterSpacing: "-.01em" }}>RXG</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute }}>RAGING X</div>
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 38, letterSpacing: "-.02em" }}>
              13<span style={{ color: SQ.steel, margin: "0 8px" }}>·</span>
              <span style={{ color: SQ.slate }}>9</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{ fontFamily: FONT.display, fontSize: 30, letterSpacing: "-.01em", color: SQ.faint }}
              >
                NGF
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute }}>NIGHTFALL</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".1em", color: SQ.mute }}
            >
              MAP 2 / HAVEN
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: SQ.league,
                background: SQ.red,
                padding: "8px 14px",
                borderRadius: 3,
                fontWeight: 700,
              }}
            >
              Watch ▸
            </div>
          </div>
        </Link>
      </div>

      {/* stat tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          border: `1px solid ${SQ.hairline}`,
          borderRadius: 8,
          overflow: "hidden",
          marginTop: 28,
        }}
      >
        {statTiles.map((s) => (
          <div
            key={s.label}
            style={{
              padding: "20px 24px",
              borderRight: `1px solid ${SQ.hairlineCell}`,
              borderBottom: `1px solid ${SQ.hairlineCell}`,
            }}
          >
            <div
              style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: ".16em", color: SQ.label }}
            >
              {s.label}
            </div>
            <div
              style={{ fontFamily: FONT.display, fontSize: 34, letterSpacing: "-.02em", marginTop: 6 }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* standings + rail */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(330px,1fr))",
          gap: 28,
          marginTop: 30,
        }}
      >
        {/* standings */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={sectionLabel}>Franchise Standings</div>
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
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 520 }}>
              <div
                style={{
                  display: "flex",
                  padding: "0 4px 10px",
                  borderBottom: `1px solid ${SQ.hairline}`,
                  ...headCell,
                }}
              >
                <div style={{ width: 42 }}>#</div>
                <div style={{ flex: 1 }}>FRANCHISE</div>
                <div style={{ width: 54, textAlign: "right" }}>GP</div>
                <div style={{ width: 70, textAlign: "right" }}>PTS</div>
                <div style={{ width: 150, textAlign: "right" }}>BEST PLAYER</div>
                <div style={{ width: 48, textAlign: "right" }}>FORM</div>
              </div>
              {standingsTop.map((t) => {
                const accent = rankAccent(t.rank === "01");
                return (
                  <Link
                    key={t.rank}
                    href="/franchise"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "13px 4px",
                      borderBottom: `1px solid ${SQ.hairlineFaint}`,
                      cursor: "pointer",
                      background: accent.rowBg,
                      textDecoration: "none",
                      color: SQ.ink,
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        fontFamily: FONT.display,
                        fontSize: 18,
                        color: accent.color,
                      }}
                    >
                      {t.rank}
                    </div>
                    <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                      {t.name}
                      {t.sub ? (
                        <span
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: 10,
                            color: SQ.mute,
                            fontWeight: 400,
                            marginLeft: 6,
                          }}
                        >
                          {t.sub}
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        width: 54,
                        textAlign: "right",
                        fontFamily: FONT.mono,
                        fontSize: 13,
                        color: SQ.faint,
                      }}
                    >
                      {t.gp}
                    </div>
                    <div
                      style={{ width: 70, textAlign: "right", fontFamily: FONT.display, fontSize: 18 }}
                    >
                      {t.pts}
                    </div>
                    <div style={{ width: 150, textAlign: "right", fontSize: 13, color: SQ.faint }}>
                      {t.best}
                    </div>
                    <div
                      style={{
                        width: 48,
                        textAlign: "right",
                        fontFamily: FONT.mono,
                        fontSize: 12,
                        color: t.formColor,
                      }}
                    >
                      {t.form}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* rail */}
        <div style={{ minWidth: 0 }}>
          <div style={{ ...sectionLabel, marginBottom: 14 }}>Upcoming</div>
          {upcoming.map((u, i) => (
            <Link
              key={i}
              href="/match"
              style={{
                display: "flex",
                gap: 14,
                padding: "13px 0",
                borderBottom: `1px solid ${SQ.hairlineFaint}`,
                cursor: "pointer",
                textDecoration: "none",
                color: SQ.ink,
              }}
            >
              <div style={{ width: 46 }}>
                <div style={{ fontFamily: FONT.display, fontSize: 20, lineHeight: 1 }}>{u.day}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute }}>{u.mon}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: ".12em",
                    color: SQ.ember,
                  }}
                >
                  {u.meta}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginTop: 3 }}>{u.title}</div>
              </div>
            </Link>
          ))}

          <div style={{ ...sectionLabel, margin: "24px 0 12px" }}>Announcements</div>
          {announceShort.map((a) => (
            <Link
              key={a.title}
              href="/announcements"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 0",
                borderBottom: `1px solid ${SQ.hairlineFaint}`,
                cursor: "pointer",
                textDecoration: "none",
                color: SQ.ink,
              }}
            >
              <div style={{ fontSize: 13.5 }}>{a.title}</div>
              <div style={{ color: SQ.dim }}>▸</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
