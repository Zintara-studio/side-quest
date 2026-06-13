import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { Toggle } from "../toggle";
import { adminGames } from "@/lib/mock/admin";

const statLabel = {
  fontFamily: FONT.mono,
  fontSize: 9.5,
  letterSpacing: ".1em",
  color: SQ.label,
} as const;

const statValue = {
  fontFamily: FONT.mono,
  fontSize: 12,
  marginTop: 3,
} as const;

export function GamesScreen() {
  return (
    <div>
      <ScreenHeader eyebrow="Title settings" title="GAMES" />
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".1em",
          color: SQ.mute,
          margin: "12px 0 24px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        TOGGLE TITLES & REGISTRATION WINDOWS FOR SEASON 04
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
          gap: 16,
        }}
      >
        {adminGames.map((g) => (
          <div
            key={g.name}
            style={{
              background: SQ.panel,
              border: `1px solid ${SQ.hairline}`,
              borderRadius: 9,
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: FONT.display, fontSize: 18, letterSpacing: "-.02em" }}>
                {g.name}
              </div>
              <Toggle on={g.on} />
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
              <div>
                <div style={statLabel}>FORMAT</div>
                <div style={{ ...statValue, color: SQ.faint }}>{g.format}</div>
              </div>
              <div>
                <div style={statLabel}>PLAYERS</div>
                <div style={{ ...statValue, color: SQ.faint }}>{g.players}</div>
              </div>
              <div>
                <div style={statLabel}>REGISTRATION</div>
                <div style={{ ...statValue, color: g.reg === "Open" ? SQ.green : SQ.mute }}>
                  {g.reg}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
