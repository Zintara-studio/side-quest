import Link from "next/link";
import { SQ, FONT, matchStatusColors } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { adminMatches, matchFilters } from "@/lib/mock/admin";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

export function MatchesScreen() {
  return (
    <div>
      <ScreenHeader
        eyebrow="Fixtures & results"
        title="MATCHES"
        action={
          <Link
            href="/admin/matches/result"
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: SQ.sidebar,
              background: SQ.red,
              padding: "11px 16px",
              borderRadius: 5,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            + Schedule match
          </Link>
        }
      />

      {/* filter chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "22px 0 18px" }}>
        {matchFilters.map((label, i) => {
          const active = i === 0;
          return (
            <div
              key={label}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".06em",
                padding: "8px 13px",
                borderRadius: 5,
                border: `1px solid ${active ? SQ.red : SQ.inputBorder}`,
                color: active ? SQ.sidebar : SQ.faint,
                background: active ? SQ.red : "transparent",
                cursor: "pointer",
              }}
            >
              {label}
            </div>
          );
        })}
      </div>

      <TableScroll minWidth={760}>
        <div
          style={{
            display: "flex",
            padding: "14px 18px",
            borderBottom: `1px solid ${SQ.hairline}`,
            ...headCell,
          }}
        >
          <div style={{ flex: 1.4 }}>MATCH</div>
          <div style={{ width: 110 }}>GAME</div>
          <div style={{ width: 120 }}>SCHEDULE</div>
          <div style={{ width: 110 }}>STATUS</div>
          <div style={{ width: 150, textAlign: "right" }}>ACTION</div>
        </div>

        {adminMatches.map((m) => {
          const [stColor, stBorder] = matchStatusColors(m.status);
          const needs = m.status === "Awaiting result";
          return (
            <div
              key={m.title}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "15px 18px",
                borderBottom: `1px solid ${SQ.hairlineSoft}`,
              }}
            >
              <div style={{ flex: 1.4 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{m.title}</div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    color: SQ.mute,
                    marginTop: 2,
                  }}
                >
                  {m.teams}
                </div>
              </div>
              <div style={{ width: 110, fontFamily: FONT.mono, fontSize: 11, color: SQ.faint }}>
                {m.game}
              </div>
              <div style={{ width: 120, fontFamily: FONT.mono, fontSize: 11, color: SQ.faint }}>
                {m.when}
              </div>
              <div style={{ width: 110 }}>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: ".1em",
                    color: stColor,
                    border: `1px solid ${stBorder}`,
                    padding: "4px 9px",
                    borderRadius: 9,
                  }}
                >
                  {m.status}
                </span>
              </div>
              <div style={{ width: 150, textAlign: "right" }}>
                <Link
                  href="/admin/matches/result"
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10.5,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: needs ? SQ.sidebar : SQ.faint,
                    background: needs ? SQ.red : "transparent",
                    border: `1px solid ${needs ? SQ.red : SQ.inputBorder}`,
                    padding: "8px 12px",
                    borderRadius: 5,
                    textDecoration: "none",
                  }}
                >
                  {needs ? "Enter result" : "Edit"}
                </Link>
              </div>
            </div>
          );
        })}
      </TableScroll>
    </div>
  );
}
