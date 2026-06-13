import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { adminFranchises } from "@/lib/mock/admin";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

const rowBtn = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: SQ.faint,
  border: `1px solid ${SQ.inputBorder}`,
  background: "transparent",
  padding: "7px 11px",
  borderRadius: 5,
  cursor: "pointer",
} as const;

export function FranchisesScreen() {
  return (
    <div>
      <ScreenHeader
        eyebrow="Teams & rosters"
        title="FRANCHISES"
        action={
          <button
            type="button"
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: SQ.sidebar,
              background: SQ.red,
              border: "none",
              padding: "11px 16px",
              borderRadius: 5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Add franchise
          </button>
        }
      />

      <TableScroll minWidth={740} marginTop={22}>
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
          <div style={{ width: 130 }}>IGL</div>
          <div style={{ width: 80, textAlign: "center" }}>PLAYERS</div>
          <div style={{ width: 80, textAlign: "right" }}>PTS</div>
          <div style={{ width: 160, textAlign: "right" }}>ACTION</div>
        </div>

        {adminFranchises.map((f) => (
          <div
            key={f.name}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "14px 18px",
              borderBottom: `1px solid ${SQ.hairlineSoft}`,
            }}
          >
            <div
              style={{
                width: 44,
                fontFamily: FONT.display,
                fontSize: 16,
                color: f.rank === "01" ? SQ.red : SQ.steel,
              }}
            >
              {f.rank}
            </div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>
              {f.name}
              {f.sub ? (
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    color: SQ.mute,
                    fontWeight: 400,
                    marginLeft: 6,
                  }}
                >
                  {f.sub}
                </span>
              ) : null}
            </div>
            <div style={{ width: 130, fontSize: 13, color: SQ.faint }}>{f.igl}</div>
            <div
              style={{
                width: 80,
                textAlign: "center",
                fontFamily: FONT.mono,
                fontSize: 13,
                color: SQ.faint,
              }}
            >
              {f.players}
            </div>
            <div style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 16 }}>
              {f.pts}
            </div>
            <div
              style={{
                width: 160,
                textAlign: "right",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <button type="button" style={rowBtn}>
                Edit
              </button>
              <button type="button" style={rowBtn}>
                Points
              </button>
            </div>
          </div>
        ))}
      </TableScroll>
    </div>
  );
}
