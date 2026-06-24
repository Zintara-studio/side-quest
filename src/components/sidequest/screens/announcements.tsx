"use client";

import Link from "next/link";
import { SQ, FONT, announcementTagColors } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import { useAnnouncements } from "@/lib/query/hooks";
import { announcementTagFor, shortDate } from "@/lib/adapters/league";

export function AnnouncementsScreen() {
  const { data, isLoading, isError } = useAnnouncements({ limit: 20 });
  const items = data?.items ?? [];

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
        RESULTS · LEAGUE NEWS · REGISTRATION CALLS
      </div>

      {isLoading ? (
        <StateNote>Loading announcements…</StateNote>
      ) : items.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't reach the league API." : "No announcements yet."}
        </StateNote>
      ) : (
        <div style={{ border: `1px solid ${SQ.hairline}`, borderRadius: 8, overflow: "hidden" }}>
          {items.map((a) => {
            const tag = announcementTagFor(a.category);
            const [tagColor, tagBorder] = announcementTagColors(tag);
            return (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 14,
                  alignItems: "center",
                  padding: "20px 22px",
                  borderBottom: `1px solid ${SQ.hairlineCell}`,
                  color: SQ.ink,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: ".14em",
                    color: a.registrationOpen ? SQ.ember : tagColor,
                    border: `1px solid ${a.registrationOpen ? "rgba(232,96,44,.45)" : tagBorder}`,
                    padding: "5px 9px",
                    borderRadius: 4,
                    width: 96,
                    textAlign: "center",
                  }}
                >
                  {a.registrationOpen ? "REGISTER" : tag}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{a.title}</div>
                  {a.body ? (
                    <div style={{ fontSize: 13, color: SQ.faint, marginTop: 4, lineHeight: 1.5 }}>
                      {a.body}
                    </div>
                  ) : null}
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".1em",
                    color: SQ.mute,
                    whiteSpace: "nowrap",
                  }}
                >
                  {shortDate(a.publishedAt)}
                </div>
                {a.registrationOpen ? (
                  <Link
                    href={`/register?announcement=${a.id}`}
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: SQ.league,
                      background: SQ.red,
                      padding: "9px 15px",
                      borderRadius: 5,
                      fontWeight: 700,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.gameName ? `Register · ${a.gameName} ▸` : "Register ▸"}
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
