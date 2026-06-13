import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { TableScroll } from "../table-scroll";
import { adminResultEntry } from "@/lib/mock/admin";

const statBox = {
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "8px 0",
  width: 64,
  textAlign: "center",
  fontFamily: FONT.mono,
  fontSize: 14,
} as const;

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

export function ResultScreen() {
  return (
    <div>
      <Link
        href="/admin/matches"
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: ".14em",
          color: SQ.mute,
          textDecoration: "none",
        }}
      >
        ◂ MATCHES
      </Link>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: SQ.red,
          marginTop: 14,
        }}
      >
        Enter result · BGMI · Matchday 18
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: "clamp(30px,4.5vw,48px)",
          lineHeight: 0.92,
          letterSpacing: "-.03em",
          marginTop: 10,
        }}
      >
        BGMI ALL-SQUAD LOBBY
      </div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".1em",
          color: SQ.mute,
          margin: "12px 0 26px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        16 SQUADS · ERANGEL · ENTER PLACEMENT & KILLS, THEN PUBLISH
      </div>

      <TableScroll minWidth={620}>
        <div
          style={{
            display: "flex",
            padding: "14px 18px",
            borderBottom: `1px solid ${SQ.hairline}`,
            ...headCell,
          }}
        >
          <div style={{ width: 60 }}>PLACE</div>
          <div style={{ flex: 1 }}>SQUAD</div>
          <div style={{ width: 120, textAlign: "center" }}>KILLS</div>
          <div style={{ width: 120, textAlign: "center" }}>PLACE PTS</div>
          <div style={{ width: 90, textAlign: "right" }}>TOTAL</div>
        </div>

        {adminResultEntry.map((r) => {
          const first = r.place === "1";
          return (
            <div
              key={r.place}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "11px 18px",
                borderBottom: `1px solid ${SQ.hairlineSoft}`,
                background: first
                  ? "linear-gradient(90deg,rgba(255,61,46,.08),transparent)"
                  : "transparent",
              }}
            >
              <div
                style={{
                  width: 60,
                  fontFamily: FONT.display,
                  fontSize: 18,
                  color: first ? SQ.red : SQ.steel,
                }}
              >
                {r.place}
              </div>
              <div style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{r.team}</div>
              <div style={{ width: 120, display: "flex", justifyContent: "center" }}>
                <div style={statBox}>{r.kills}</div>
              </div>
              <div style={{ width: 120, display: "flex", justifyContent: "center" }}>
                <div style={{ ...statBox, color: SQ.faint }}>{r.placePts}</div>
              </div>
              <div
                style={{
                  width: 90,
                  textAlign: "right",
                  fontFamily: FONT.display,
                  fontSize: 17,
                }}
              >
                {r.total}
              </div>
            </div>
          );
        })}
      </TableScroll>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
        <Link
          href="/admin/matches"
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: SQ.sidebar,
            background: SQ.red,
            padding: "13px 20px",
            borderRadius: 5,
            textDecoration: "none",
          }}
        >
          Publish result ▸
        </Link>
        <button
          type="button"
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: SQ.faint,
            background: "transparent",
            border: "1px solid rgba(255,255,255,.18)",
            padding: "13px 20px",
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          Save draft
        </button>
      </div>
    </div>
  );
}
