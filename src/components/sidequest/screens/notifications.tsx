"use client";

import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";
import { StateNote } from "../state-note";
import { useAuth } from "@/lib/auth/context";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/lib/query/hooks";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function typeColor(type: string): string {
  switch (type) {
    case "RESULT":
    case "ANNOUNCEMENT":
      return SQ.ember;
    case "MATCH":
      return SQ.blue;
    case "REGISTRATION":
      return SQ.amber;
    case "AUCTION":
      return SQ.green;
    default:
      return SQ.mute;
  }
}

export function NotificationsScreen() {
  const { isAuthenticated, hydrated } = useAuth();
  const { data, isLoading, isError } = useNotifications(isAuthenticated);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = data ?? [];
  const unread = items.filter((n) => !n.read).length;

  if (hydrated && !isAuthenticated) {
    return (
      <div>
        <LeagueTitle eyebrow="Your inbox" title="NOTIFICATIONS" />
        <div style={{ marginTop: 22 }}>
          <StateNote>
            Sign in to view your notifications.{" "}
            <Link href="/login" style={{ color: SQ.ember, textDecoration: "none", fontWeight: 600 }}>
              Sign in ▸
            </Link>
          </StateNote>
        </div>
      </div>
    );
  }

  return (
    <div>
      <LeagueTitle eyebrow="Your inbox" title="NOTIFICATIONS" />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          margin: "16px 0 22px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute }}>
          {items.length} TOTAL · {unread} UNREAD
        </div>
        <button
          type="button"
          onClick={() => markAll.mutate()}
          disabled={unread === 0 || markAll.isPending}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: unread === 0 ? SQ.mute : SQ.ink,
            background: "transparent",
            border: `1px solid ${SQ.inputBorder}`,
            padding: "8px 13px",
            borderRadius: 5,
            cursor: unread === 0 ? "not-allowed" : "pointer",
            opacity: unread === 0 ? 0.6 : 1,
          }}
        >
          Mark all read
        </button>
      </div>

      {isLoading ? (
        <StateNote>Loading notifications…</StateNote>
      ) : items.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load your notifications." : "You're all caught up — no notifications."}
        </StateNote>
      ) : (
        <div style={{ border: `1px solid ${SQ.hairline}`, borderRadius: 8, overflow: "hidden" }}>
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.linkUrl || "/notifications"}
              onClick={() => {
                if (!n.read) markRead.mutate(n.id);
              }}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                padding: "16px 20px",
                borderBottom: `1px solid ${SQ.hairlineCell}`,
                textDecoration: "none",
                color: SQ.ink,
                background: n.read ? "transparent" : "rgba(232,96,44,.06)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  marginTop: 6,
                  flex: "0 0 auto",
                  background: n.read ? SQ.steel : typeColor(n.type),
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 14.5, fontWeight: n.read ? 500 : 700 }}>{n.title}</span>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10.5,
                      color: SQ.mute,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timeAgo(n.createdAt)}
                  </span>
                </div>
                {n.body ? (
                  <div style={{ fontSize: 13, color: SQ.faint, marginTop: 4, lineHeight: 1.5 }}>
                    {n.body}
                  </div>
                ) : null}
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    letterSpacing: ".12em",
                    color: typeColor(n.type),
                    marginTop: 6,
                  }}
                >
                  {n.type}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
