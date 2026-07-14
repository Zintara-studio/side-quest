"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { playerHref } from "@/lib/routes";
import { useCurrentSeason, useNotifications } from "@/lib/query/hooks";
import { ThemeToggle } from "@/lib/theme";
import { NotificationBell } from "./notification-bell";
import { ConfirmModal } from "./confirm-modal";
import { SQ, FONT } from "./tokens";

/** Which nav tab an unread notification's type should badge. */
function navKeyForType(type: string): string | null {
  switch (type) {
    case "ANNOUNCEMENT":
      return "announcements";
    case "AUCTION":
      // No auction nav tab — auction alerts live in the notification bell only.
      return null;
    case "MATCH":
    case "RESULT":
      return "match";
    case "REGISTRATION":
      return "my";
    default:
      return null;
  }
}

/** Small unread-count badge shown beside a nav label. */
function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      style={{
        marginLeft: 6,
        fontFamily: FONT.mono,
        fontSize: 9,
        fontWeight: 700,
        color: SQ.league,
        background: SQ.red,
        borderRadius: 999,
        padding: "1px 6px",
        verticalAlign: "middle",
      }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

const navLinks = [
  { key: "home", label: "Home", href: "/" },
  { key: "games", label: "Games", href: "/games" },
  { key: "franchises", label: "Franchises", href: "/franchises" },
  { key: "players", label: "Players", href: "/players" },
  { key: "match", label: "Matches", href: "/match" },
  { key: "announcements", label: "Announcements", href: "/announcements" },
];

function activeKey(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/games")) return "games";
  if (pathname.startsWith("/franchise")) return "franchises"; // franchises + franchise
  if (pathname.startsWith("/player")) return "players"; // players + player
  if (pathname.startsWith("/match")) return "match";
  if (pathname.startsWith("/announcements")) return "announcements";
  if (pathname.startsWith("/auction")) return "auction"; // top-level spectator route
  if (pathname.startsWith("/my/franchise")) return "myFranchise"; // must precede the generic /my check
  if (pathname.startsWith("/my")) return "my";
  return "home";
}

export function LeagueShell({
  children,
  fontClass,
}: {
  children: ReactNode;
  fontClass: string;
}) {
  const pathname = usePathname() ?? "/";
  const cur = activeKey(pathname);
  const router = useRouter();
  const { user, playerId, gamerTag, isAuthenticated, isAdmin, logout } = useAuth();

  // Real current season drives the nav badge + footer tagline; falls back to a
  // neutral off-season label when no season is active (or while it loads).
  const season = useCurrentSeason().data ?? null;
  const seasonCode = season?.code ?? "—";

  // The auction has NO nav tab (intentionally removed — it only clutters the bar). It's reached from the
  // home page (all players) and the My Franchise page (owners/managers). The /auction page itself shows
  // the standing pool when no auction is live, so those contextual links are never a dead end.
  const links = navLinks;
  const seasonTagline = season
    ? `${season.name.toUpperCase()} · BUILT FOR THE FRANCHISES`
    : "OFF-SEASON · BUILT FOR THE FRANCHISES";

  // Per-tab unread badges (e.g. "Announcements 2") — derived from the notification feed by type.
  const notifs = useNotifications(isAuthenticated).data ?? [];
  const unreadByKey = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notifs) {
      if (n.read) continue;
      const key = navKeyForType(n.type);
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [notifs]);

  const [confirmOut, setConfirmOut] = useState(false);

  // Admins are welcome on the public site (an appointed admin is also a player) — no eviction.
  // A "Control room" switch (below) takes them to /admin when they want it.

  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div
      className={cn("admin-scope", fontClass)}
      style={{
        minHeight: "100vh",
        background: SQ.league,
        color: SQ.ink,
        fontFamily: FONT.sans,
      }}
    >
      {/* ===== NAV ===== */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px 22px",
          flexWrap: "wrap",
          padding: "13px clamp(16px,4vw,30px)",
          background: SQ.navBg,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            cursor: "pointer",
            textDecoration: "none",
            color: SQ.ink,
          }}
        >
          <div style={{ width: 13, height: 13, background: SQ.red, transform: "rotate(45deg)" }} />
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 19,
              letterSpacing: ".005em",
              whiteSpace: "nowrap",
            }}
          >
            SIDE QUEST
          </span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".14em",
              color: SQ.dim,
              border: `1px solid ${SQ.field}`,
              padding: "3px 7px",
              borderRadius: 3,
            }}
          >
            {seasonCode}
          </span>
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(16px,2.2vw,26px)",
            flexWrap: "wrap",
          }}
        >
          {links.map((link) => {
            const active = cur === link.key;
            return (
              <Link
                key={link.key}
                href={link.href}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11.5,
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  color: active ? SQ.ink : SQ.mute,
                  textDecoration: "none",
                  paddingBottom: 4,
                  borderBottom: `2px solid ${active ? SQ.red : "transparent"}`,
                  whiteSpace: "nowrap",
                }}
              >
                {link.label}
                <NavBadge count={unreadByKey[link.key] ?? 0} />
              </Link>
            );
          })}
          {isAuthenticated && user && user.role !== "ADMIN" ? (
            <Link
              href="/my/registrations"
              style={{
                fontFamily: FONT.mono,
                fontSize: 11.5,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: cur === "my" ? SQ.ink : SQ.mute,
                textDecoration: "none",
                paddingBottom: 4,
                borderBottom: `2px solid ${cur === "my" ? SQ.red : "transparent"}`,
                whiteSpace: "nowrap",
              }}
            >
              My Team
              <NavBadge count={unreadByKey["my"] ?? 0} />
            </Link>
          ) : null}
          {isAuthenticated && user && user.role !== "ADMIN" ? (
            <Link
              href="/my/franchise"
              style={{
                fontFamily: FONT.mono,
                fontSize: 11.5,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: cur === "myFranchise" ? SQ.ink : SQ.mute,
                textDecoration: "none",
                paddingBottom: 4,
                borderBottom: `2px solid ${cur === "myFranchise" ? SQ.red : "transparent"}`,
                whiteSpace: "nowrap",
              }}
            >
              My Franchise
            </Link>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {isAdmin ? (
            <Link
              href="/admin"
              title="Go to the admin control room"
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: SQ.ember,
                textDecoration: "none",
                border: `1px solid ${SQ.ember}`,
                borderRadius: 999,
                padding: "5px 11px",
                whiteSpace: "nowrap",
              }}
            >
              Control room ▸
            </Link>
          ) : null}
          <NotificationBell />
          <ThemeToggle />
          {isAuthenticated && user ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                borderLeft: `1px solid ${SQ.avatarBorder}`,
                paddingLeft: 14,
              }}
            >
              <Link
                href={playerId ? playerHref(gamerTag ?? playerId) : isAdmin ? "/admin" : "/player"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  cursor: "pointer",
                  textDecoration: "none",
                  color: SQ.ink,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: SQ.avatarGrad,
                    border: `1px solid ${SQ.inputBorder}`,
                  }}
                />
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9.5,
                      letterSpacing: ".1em",
                      color: SQ.label,
                    }}
                  >
                    {user.role}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setConfirmOut(true)}
                title="Sign out"
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: SQ.mute,
                  background: "transparent",
                  border: `1px solid ${SQ.inputBorder}`,
                  padding: "7px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderLeft: `1px solid ${SQ.avatarBorder}`,
                paddingLeft: 14,
              }}
            >
              <Link
                href="/login"
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: SQ.faint,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: SQ.league,
                  background: SQ.red,
                  padding: "9px 15px",
                  borderRadius: 4,
                  fontWeight: 700,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Create account ▸
              </Link>
            </div>
          )}
        </div>
      </nav>

      <main
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          // extra bottom padding so content is never hidden behind the pinned footer
          padding: "clamp(24px,4vw,40px) clamp(16px,4vw,30px) clamp(96px,10vh,120px)",
        }}
      >
        {children}
      </main>

      {/* pinned footer — stays at the bottom of the viewport as content scrolls */}
      <footer
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          background: SQ.navBg,
          backdropFilter: "blur(12px)",
          borderTop: `1px solid ${SQ.hairline}`,
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "14px clamp(16px,4vw,30px)",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".14em",
            color: SQ.dim,
          }}
        >
          <div>SIDE QUEST · COMMUNITY ESPORTS LEAGUE</div>
          <div>{seasonTagline}</div>
        </div>
      </footer>

      <ConfirmModal
        open={confirmOut}
        title="Sign out?"
        message="You'll need to sign in again to manage your team, register, or see your notifications."
        confirmLabel="Sign out"
        onConfirm={() => {
          setConfirmOut(false);
          onLogout();
        }}
        onClose={() => setConfirmOut(false)}
      />
    </div>
  );
}
