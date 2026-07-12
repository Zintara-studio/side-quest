"use client";

import Link from "next/link";
import { SQ, FONT, announcementTagColors } from "../tokens";
import { StateNote } from "../state-note";
import { MarkdownView } from "../markdown";
import { useAnnouncement } from "@/lib/query/hooks";
import { announcementTagFor, shortDate } from "@/lib/adapters/league";
import { matchHref, registerHref } from "@/lib/routes";

/** A single announcement as a readable page — the "read it here" surface the home/feed cards link to. */
export function AnnouncementDetailScreen({ id }: { id: string }) {
  const { data: a, isLoading, isError } = useAnnouncement(id);

  if (isLoading) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px" }}>
        <StateNote>Loading…</StateNote>
      </div>
    );
  }
  if (isError || !a) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px" }}>
        <StateNote tone="error">This announcement no longer exists.</StateNote>
        <Link href="/announcements" style={{ color: SQ.ember, fontSize: 13, marginTop: 14, display: "inline-block" }}>
          ◂ All announcements
        </Link>
      </div>
    );
  }

  const tag = announcementTagFor(a.category);
  const [tagColor, tagBorder] = announcementTagColors(tag);

  const chip = {
    fontFamily: FONT.mono,
    fontSize: 10,
    letterSpacing: ".14em",
    padding: "5px 10px",
    borderRadius: 4,
  } as const;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(24px,4vw,44px) 20px 70px" }}>
      <Link
        href="/announcements"
        style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".14em", color: SQ.mute, textDecoration: "none" }}
      >
        ◂ ANNOUNCEMENTS
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "22px 0 14px" }}>
        <span style={{ ...chip, color: a.registrationOpen ? SQ.ember : tagColor, border: `1px solid ${a.registrationOpen ? "rgba(232,96,44,.45)" : tagBorder}` }}>
          {a.registrationOpen ? "REGISTER" : tag}
        </span>
        {a.pinned ? (
          <span style={{ ...chip, color: SQ.ember, border: "1px solid rgba(232,96,44,.45)" }}>★ PINNED</span>
        ) : null}
        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute }}>
          {shortDate(a.publishedAt)}
          {a.gameName ? ` · ${a.gameName}` : ""}
        </span>
      </div>

      <h1 style={{ fontFamily: FONT.display, fontSize: "clamp(26px,4.5vw,40px)", letterSpacing: "-.01em", lineHeight: 1.1, margin: "0 0 22px" }}>
        {a.title}
      </h1>

      <div style={{ fontSize: 15, lineHeight: 1.7, color: SQ.ink }}>
        <MarkdownView content={a.body} />
      </div>

      {a.registrationOpen ? (
        <Link
          href={registerHref(a.shortCode)}
          style={{
            display: "inline-block",
            marginTop: 28,
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: SQ.league,
            background: SQ.red,
            padding: "12px 20px",
            borderRadius: 6,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {a.gameName ? `Register · ${a.gameName} ▸` : "Register ▸"}
        </Link>
      ) : a.category === "RESULT" && a.matchId ? (
        <Link
          href={matchHref(a.matchSlug ?? a.matchId ?? "")}
          style={{
            display: "inline-block",
            marginTop: 28,
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: SQ.ember,
            textDecoration: "none",
          }}
        >
          View result ▸
        </Link>
      ) : null}
    </div>
  );
}
