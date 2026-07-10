"use client";

import Link from "next/link";
import { useState } from "react";
import { SQ, FONT, announcementTagColors } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import { MarkdownView } from "../markdown";
import { useAnnouncementsInfinite } from "@/lib/query/hooks";
import { announcementTagFor, shortDate } from "@/lib/adapters/league";
import type { AnnouncementView } from "@/lib/api/types";

// Roughly how much body text counts as "long enough to collapse".
const PREVIEW_LIMIT = 200;

// Strip common markdown syntax for a clean single-block collapsed preview
// (truncating the raw markdown source could cut mid-link/mid-image).
function plainPreview(md: string, limit = PREVIEW_LIMIT) {
  const text = md
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s{0,3}>\s?/gm, "") // blockquote markers
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, "") // list markers
    .replace(/(\*\*|__|\*|_|~~|`)/g, "") // emphasis / inline code
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

function AnnouncementRow({ a }: { a: AnnouncementView }) {
  const [expanded, setExpanded] = useState(false);
  const tag = announcementTagFor(a.category);
  const [tagColor, tagBorder] = announcementTagColors(tag);
  const isLong = a.body.trim().length > PREVIEW_LIMIT;

  const toggleStyle = {
    fontFamily: FONT.mono,
    fontSize: 11,
    letterSpacing: ".1em",
    textTransform: "uppercase" as const,
    color: SQ.ember,
    background: "transparent",
    border: "none",
    padding: 0,
    marginTop: 8,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        alignItems: "flex-start",
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
          marginTop: 2,
        }}
      >
        {a.registrationOpen ? "REGISTER" : tag}
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{a.title}</div>
        {a.body ? (
          isLong && !expanded ? (
            <>
              <div style={{ fontSize: 13, color: SQ.faint, marginTop: 4, lineHeight: 1.5 }}>
                {plainPreview(a.body)}
              </div>
              <button type="button" onClick={() => setExpanded(true)} style={toggleStyle}>
                Read more ▾
              </button>
            </>
          ) : (
            <div style={{ marginTop: 6 }}>
              <MarkdownView content={a.body} />
              {isLong ? (
                <button type="button" onClick={() => setExpanded(false)} style={toggleStyle}>
                  Show less ▴
                </button>
              ) : null}
            </div>
          )
        ) : null}
      </div>
      {/* Date + action live in one right-aligned stack (date on top, action
          below) so the button never shoves the date around; the whole stack
          wraps under the copy on narrow screens. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          marginLeft: "auto",
          marginTop: 2,
        }}
      >
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
        ) : a.category === "RESULT" && a.matchId ? (
          <Link
            href={`/match/${a.matchId}`}
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: SQ.ember,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            View result ▸
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function AnnouncementsScreen() {
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAnnouncementsInfinite({ limit: 20 });
  const items = (data?.pages ?? []).flatMap((p) => p.items);

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
          {items.map((a) => (
            <AnnouncementRow key={a.id} a={a} />
          ))}
        </div>
      )}

      {hasNextPage ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            style={{
              fontFamily: FONT.mono,
              fontSize: 11.5,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: SQ.faint,
              background: "transparent",
              border: `1px solid ${SQ.inputBorder}`,
              borderRadius: 6,
              padding: "10px 20px",
              cursor: isFetchingNextPage ? "not-allowed" : "pointer",
            }}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
