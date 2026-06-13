import { SQ, FONT, announcementTagColors } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { adminAnnouncements } from "@/lib/mock/admin";

const fieldLabel = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".16em",
  color: SQ.label,
} as const;

const inputBox = {
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "13px 14px",
  fontSize: 14,
  color: SQ.mute,
} as const;

const chipBase = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".06em",
  padding: "7px 11px",
  borderRadius: 5,
  cursor: "pointer",
} as const;

export function AnnouncementsScreen() {
  return (
    <div>
      <ScreenHeader eyebrow="Broadcast" title="ANNOUNCEMENTS" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 24,
          marginTop: 24,
          alignItems: "start",
        }}
      >
        {/* composer */}
        <div
          style={{
            background: SQ.panel,
            border: `1px solid ${SQ.hairline}`,
            borderRadius: 9,
            padding: 22,
          }}
        >
          <div style={{ ...fieldLabel, marginBottom: 8 }}>NEW POST · TITLE</div>
          <div style={inputBox}>e.g. BGMI Match 4 — results live</div>

          <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>CATEGORY</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={{ ...chipBase, color: SQ.sidebar, background: SQ.red, border: "none", fontWeight: 600 }}
            >
              RESULT
            </button>
            <button
              type="button"
              style={{ ...chipBase, color: SQ.faint, background: "transparent", border: `1px solid ${SQ.inputBorder}` }}
            >
              LEAGUE
            </button>
            <button
              type="button"
              style={{ ...chipBase, color: SQ.faint, background: "transparent", border: `1px solid ${SQ.inputBorder}` }}
            >
              RECAP
            </button>
          </div>

          <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>BODY</div>
          <div style={{ ...inputBox, minHeight: 96, lineHeight: 1.5 }}>
            Write the announcement copy…
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              type="button"
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: SQ.sidebar,
                background: SQ.red,
                border: "none",
                padding: 13,
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              Publish ▸
            </button>
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
                padding: "13px 18px",
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              Draft
            </button>
          </div>
        </div>

        {/* published list */}
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Published
          </div>
          {adminAnnouncements.map((a) => {
            const [tagColor, tagBorder] = announcementTagColors(a.tag);
            return (
              <div
                key={a.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "15px 16px",
                  background: SQ.panel,
                  border: `1px solid ${SQ.hairline}`,
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    letterSpacing: ".12em",
                    color: tagColor,
                    border: `1px solid ${tagBorder}`,
                    padding: "4px 8px",
                    borderRadius: 4,
                    width: 74,
                    textAlign: "center",
                    flex: "0 0 auto",
                  }}
                >
                  {a.tag}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div>
                  <div
                    style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, marginTop: 2 }}
                  >
                    {a.date}
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: SQ.mute,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
