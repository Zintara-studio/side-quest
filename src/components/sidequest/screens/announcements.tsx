import Link from "next/link";
import { SQ, FONT, announcementTagColors } from "../tokens";
import { LeagueTitle } from "../league-title";
import { announcements } from "@/lib/mock/league";

export function AnnouncementsScreen() {
  return (
    <div>
      <LeagueTitle eyebrow="League feed" title="ANNOUNCEMENTS" />
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".1em",
          color: SQ.mute,
          margin: "14px 0 26px",
          paddingBottom: 24,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        RESULTS · LEAGUE NEWS · RECAPS
      </div>

      <div style={{ border: `1px solid ${SQ.hairline}`, borderRadius: 8, overflow: "hidden" }}>
        {announcements.map((a) => {
          const [tagColor, tagBorder] = announcementTagColors(a.tag);
          return (
            <Link
              key={a.title}
              href="/match"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                padding: "20px 22px",
                borderBottom: `1px solid ${SQ.hairlineCell}`,
                cursor: "pointer",
                textDecoration: "none",
                color: SQ.ink,
              }}
            >
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: ".14em",
                  color: tagColor,
                  border: `1px solid ${tagBorder}`,
                  padding: "5px 9px",
                  borderRadius: 4,
                  width: 96,
                  textAlign: "center",
                }}
              >
                {a.tag}
              </div>
              <div style={{ flex: 1, minWidth: 200, fontSize: 17, fontWeight: 600 }}>{a.title}</div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: ".1em",
                  color: SQ.mute,
                }}
              >
                {a.date}
              </div>
              <div style={{ color: SQ.dim }}>▸</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
