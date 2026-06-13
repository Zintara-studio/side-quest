import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { adminPending } from "@/lib/mock/admin";

const tabBase = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".1em",
  padding: "8px 14px",
  borderRadius: 5,
  cursor: "pointer",
} as const;

const cardBtn = {
  flex: 1,
  textAlign: "center",
  fontFamily: FONT.mono,
  fontSize: 10.5,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 700,
  padding: 10,
  borderRadius: 5,
  cursor: "pointer",
} as const;

export function RegistrationsScreen() {
  return (
    <div>
      <ScreenHeader eyebrow="Approval queue" title="REGISTRATIONS" />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          margin: "14px 0 24px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute }}>
          14 PENDING · 8 PLAYERS · 6 SQUADS
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            style={{ ...tabBase, background: SQ.red, color: SQ.sidebar, fontWeight: 600, border: "none" }}
          >
            PLAYERS
          </button>
          <button
            type="button"
            style={{
              ...tabBase,
              background: "transparent",
              border: `1px solid ${SQ.inputBorder}`,
              color: SQ.faint,
            }}
          >
            SQUADS
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))",
          gap: 16,
        }}
      >
        {adminPending.map((p) => (
          <div
            key={p.name}
            style={{
              background: SQ.panel,
              border: `1px solid ${SQ.hairline}`,
              borderRadius: 9,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: SQ.avatar,
                  border: `1px solid ${SQ.avatarBorder}`,
                  flex: "0 0 auto",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: ".08em",
                    color: SQ.mute,
                    marginTop: 2,
                  }}
                >
                  {p.meta}
                </div>
              </div>
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  letterSpacing: ".1em",
                  color: SQ.amber,
                  border: "1px solid rgba(224,168,46,.4)",
                  padding: "4px 8px",
                  borderRadius: 9,
                }}
              >
                PENDING
              </span>
            </div>

            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "14px 0" }}>
              {p.tags.map((g) => (
                <span
                  key={g}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: ".04em",
                    color: SQ.faint,
                    border: "1px solid rgba(255,255,255,.14)",
                    padding: "5px 9px",
                    borderRadius: 5,
                  }}
                >
                  {g}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                style={{ ...cardBtn, color: SQ.sidebar, background: SQ.green, border: "none" }}
              >
                Approve
              </button>
              <button
                type="button"
                style={{
                  ...cardBtn,
                  color: SQ.ember,
                  background: "transparent",
                  border: "1px solid rgba(255,61,46,.4)",
                }}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
