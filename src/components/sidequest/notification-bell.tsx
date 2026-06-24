"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { SQ, FONT } from "./tokens";
import { useAuth } from "@/lib/auth/context";
import { useUnreadCount } from "@/lib/query/hooks";

/** Nav bell with an unread badge — only shown to signed-in users. */
export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { data } = useUnreadCount(isAuthenticated);

  if (!isAuthenticated) return null;
  const count = data?.count ?? 0;

  return (
    <Link
      href="/notifications"
      aria-label="Notifications"
      title="Notifications"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: 6,
        border: `1px solid ${SQ.inputBorder}`,
        color: SQ.mute,
        textDecoration: "none",
        flex: "0 0 auto",
      }}
    >
      <Bell size={15} />
      {count > 0 ? (
        <span
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 8,
            background: SQ.red,
            color: SQ.league,
            fontFamily: FONT.mono,
            fontSize: 9,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
