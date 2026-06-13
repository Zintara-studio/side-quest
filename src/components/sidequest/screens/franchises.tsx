import Link from "next/link";
import { SQ, FONT, rankAccent } from "../tokens";
import { LeagueTitle } from "../league-title";
import { standingsAll } from "@/lib/mock/league";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

export function FranchisesScreen() {
  return (
    <div>
      <LeagueTitle eyebrow="League table" title="FRANCHISES" />

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
          12 FRANCHISES · SEASON 04 — ONGOING
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".1em",
              padding: "8px 14px",
              borderRadius: 5,
              background: SQ.red,
              color: SQ.league,
              fontWeight: 600,
            }}
          >
            ONGOING
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".1em",
              padding: "8px 14px",
              borderRadius: 5,
              border: `1px solid ${SQ.inputBorder}`,
              color: SQ.faint,
            }}
          >
            FINISHED
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
        <div style={{ minWidth: 640 }}>
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
            <div style={{ width: 56, textAlign: "right" }}>GP</div>
            <div style={{ width: 56, textAlign: "right" }}>W</div>
            <div style={{ width: 160, textAlign: "right" }}>BEST PLAYER</div>
            <div style={{ width: 70, textAlign: "right" }}>PTS</div>
            <div style={{ width: 50, textAlign: "right" }}>FORM</div>
          </div>
          {standingsAll.map((t) => {
            const accent = rankAccent(t.rank === "01");
            return (
              <Link
                key={t.rank}
                href="/league/franchise"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 18px",
                  borderBottom: `1px solid ${SQ.hairlineSoft}`,
                  cursor: "pointer",
                  background: accent.rowBg,
                  textDecoration: "none",
                  color: SQ.ink,
                }}
              >
                <div
                  style={{ width: 44, fontFamily: FONT.display, fontSize: 17, color: accent.color }}
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
                    width: 56,
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    fontSize: 13,
                    color: SQ.faint,
                  }}
                >
                  {t.gp}
                </div>
                <div
                  style={{
                    width: 56,
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    fontSize: 13,
                    color: SQ.faint,
                  }}
                >
                  {t.w}
                </div>
                <div style={{ width: 160, textAlign: "right", fontSize: 13, color: SQ.faint }}>
                  {t.best}
                </div>
                <div
                  style={{ width: 70, textAlign: "right", fontFamily: FONT.display, fontSize: 17 }}
                >
                  {t.pts}
                </div>
                <div
                  style={{
                    width: 50,
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
  );
}
