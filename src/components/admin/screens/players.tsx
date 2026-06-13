import { SQ, FONT, playerStatusColors } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { adminPlayers } from "@/lib/mock/admin";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

export function PlayersScreen() {
  return (
    <div>
      <ScreenHeader eyebrow="Member directory" title="PLAYERS" />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          margin: "14px 0 22px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute }}>
          486 MEMBERS · 472 VERIFIED · 12 PENDING · 2 FLAGGED
        </div>
        <button
          type="button"
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".1em",
            color: SQ.mute,
            background: "transparent",
            border: `1px solid ${SQ.inputBorder}`,
            padding: "8px 13px",
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          FILTER ▾
        </button>
      </div>

      <TableScroll minWidth={720}>
        <div
          style={{
            display: "flex",
            padding: "14px 18px",
            borderBottom: `1px solid ${SQ.hairline}`,
            ...headCell,
          }}
        >
          <div style={{ flex: 1 }}>PLAYER</div>
          <div style={{ width: 140 }}>FRANCHISE</div>
          <div style={{ width: 120 }}>GAMES</div>
          <div style={{ width: 110 }}>STATUS</div>
          <div style={{ width: 120, textAlign: "right" }}>ACTION</div>
        </div>

        {adminPlayers.map((p) => {
          const [stColor, stBorder] = playerStatusColors(p.status);
          return (
            <div
              key={p.name}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "13px 18px",
                borderBottom: `1px solid ${SQ.hairlineSoft}`,
              }}
            >
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
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
              </div>
              <div style={{ width: 140, fontFamily: FONT.mono, fontSize: 11, color: SQ.faint }}>
                {p.franchise}
              </div>
              <div style={{ width: 120, fontFamily: FONT.mono, fontSize: 11, color: SQ.mute }}>
                {p.games}
              </div>
              <div style={{ width: 110 }}>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    letterSpacing: ".1em",
                    color: stColor,
                    border: `1px solid ${stBorder}`,
                    padding: "4px 9px",
                    borderRadius: 9,
                  }}
                >
                  {p.status}
                </span>
              </div>
              <div style={{ width: 120, textAlign: "right" }}>
                <button
                  type="button"
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: SQ.faint,
                    background: "transparent",
                    border: `1px solid ${SQ.inputBorder}`,
                    padding: "7px 12px",
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  Manage
                </button>
              </div>
            </div>
          );
        })}
      </TableScroll>
    </div>
  );
}
