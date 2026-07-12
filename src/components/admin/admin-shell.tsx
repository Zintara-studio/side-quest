"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/lib/theme";
import { useAuth } from "@/lib/auth/context";
import { playerHref } from "@/lib/routes";
import { useActiveAuction, useAdminOverview, useCurrentSeason, useRegistrations } from "@/lib/query/hooks";
import { ConfirmModal } from "@/components/sidequest/confirm-modal";
import { NotificationBell } from "@/components/sidequest/notification-bell";
import { SQ, FONT } from "./tokens";

interface NavItem {
  href: string;
  label: string;
  badgeKey?: "franchiseProposals" | "openDisputes" | "resultsToEnter";
  /** Renders a live-pulse "LIVE" pill instead of a numeric badge while the auction is running. */
  liveKey?: "auction";
  /** Only shown to the main admin (super-admin) — the sensitive, main-admin-only areas. */
  superOnly?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "LEAGUE",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/matches", label: "Matches", badgeKey: "resultsToEnter" },
      // The auction workflow is main-admin-only; a regular admin watches from the public auction page.
      { href: "/admin/auction", label: "Auction", liveKey: "auction", superOnly: true },
      // Match sign-ups (solo/squad per fixture). No queue badge: match registrations are live from
      // creation — there is no pending-review state since the approval system was removed.
      { href: "/admin/registrations", label: "Registrations" },
      { href: "/admin/disputes", label: "Disputes", badgeKey: "openDisputes" },
    ],
  },
  {
    label: "ENTITIES",
    items: [
      { href: "/admin/franchises", label: "Franchises", badgeKey: "franchiseProposals" },
      { href: "/admin/players", label: "Players" },
      { href: "/admin/games", label: "Games" },
    ],
  },
  { label: "COMMS", items: [{ href: "/admin/announcements", label: "Announcements" }] },
  {
    label: "SYSTEM",
    items: [
      { href: "/admin/history", label: "History" },
      { href: "/admin/team", label: "Admins", superOnly: true },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

const monoTiny: CSSProperties = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".14em",
};

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: SQ.bg,
        color: SQ.mute,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT.mono,
        fontSize: 13,
        letterSpacing: ".14em",
      }}
    >
      {children}
    </div>
  );
}

export function AdminShell({ children, fontClass }: { children: ReactNode; fontClass: string }) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const { user, playerId, gamerTag, isAdmin, isSuperAdmin, hydrated, logout } = useAuth();

  // Protect every /admin route: non-admins are bounced to sign-in.
  useEffect(() => {
    if (hydrated && !isAdmin) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isAdmin, router, pathname]);

  const seasonQ = useCurrentSeason();
  // Still needed for the Franchises nav badge: pending FRANCHISE proposals awaiting admin review.
  const pendingQ = useRegistrations({ status: "PENDING", limit: 100 }, isAdmin);
  const pendingItems = isAdmin ? pendingQ.data?.items ?? [] : [];
  const franchiseProposalCount = pendingItems.filter((r) => r.type === "FRANCHISE").length;

  const ov = useAdminOverview(isAdmin);
  const openDisputesCount = isAdmin ? ov.data?.openDisputes ?? 0 : 0;
  const resultsToEnterCount = isAdmin ? ov.data?.resultsToEnter ?? 0 : 0;

  const activeAuctionQ = useActiveAuction(isAdmin);
  const auctionLive = isAdmin && activeAuctionQ.data?.status === "LIVE";

  const [confirmOut, setConfirmOut] = useState(false);

  if (!hydrated) return <FullScreen>Checking access…</FullScreen>;
  if (!isAdmin) return <FullScreen>Redirecting to sign in…</FullScreen>;

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");

  const onLogout = async () => {
    await logout();
    router.push("/login");
  };

  const seasonLabel = seasonQ.data ? seasonQ.data.name.toUpperCase() : "BETWEEN SEASONS";

  return (
    <div
      className={cn("admin-scope", fontClass)}
      style={{
        minHeight: "100vh",
        background: SQ.bg,
        color: SQ.ink,
        fontFamily: FONT.sans,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "stretch",
      }}
    >
      {/* ===== SIDEBAR ===== */}
      <aside
        style={{
          flex: "0 0 244px",
          width: 244,
          background: SQ.sidebar,
          borderRight: `1px solid ${SQ.hairline}`,
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Link
          href="/admin"
          style={{
            // Fixed header height, shared with the topbar (below), so their bottom borders line up.
            height: 60,
            boxSizing: "border-box",
            padding: "0 22px",
            borderBottom: `1px solid ${SQ.hairline}`,
            display: "flex",
            alignItems: "center",
            gap: 11,
            textDecoration: "none",
            color: SQ.ink,
          }}
        >
          <div style={{ width: 13, height: 13, background: SQ.red, transform: "rotate(45deg)" }} />
          <span style={{ fontFamily: FONT.display, fontSize: 17, letterSpacing: ".005em", whiteSpace: "nowrap" }}>
            SIDE QUEST
          </span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              letterSpacing: ".14em",
              color: SQ.sidebar,
              background: SQ.red,
              padding: "3px 6px",
              borderRadius: 3,
              fontWeight: 700,
            }}
          >
            ADMIN
          </span>
        </Link>

        <div style={{ padding: "14px 12px", flex: 1 }}>
          {navGroups.map((grp) => (
            <div key={grp.label} style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  letterSpacing: ".2em",
                  color: SQ.steel,
                  padding: "0 12px 8px",
                }}
              >
                {grp.label}
              </div>
              {grp.items
                .filter((it) => !it.superOnly || isSuperAdmin)
                .map((it) => {
                const active = isActive(it.href);
                const badgeCount =
                  it.badgeKey === "franchiseProposals"
                    ? franchiseProposalCount
                    : it.badgeKey === "openDisputes"
                      ? openDisputesCount
                      : it.badgeKey === "resultsToEnter"
                        ? resultsToEnterCount
                        : 0;
                const badge = badgeCount > 0 ? badgeCount : null;
                // Softer amber-toned signals (franchise proposals, matches awaiting result)
                // vs the primary red queue badge (registrations, open disputes).
                const isSoftBadge =
                  it.badgeKey === "franchiseProposals" || it.badgeKey === "resultsToEnter";
                const showLive = it.liveKey === "auction" && auctionLive;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      padding: "9px 12px",
                      borderRadius: 6,
                      textDecoration: "none",
                      background: active ? "rgba(232,96,44,.14)" : "transparent",
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 2,
                        background: active ? SQ.red : SQ.toggleOff,
                        flex: "0 0 auto",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: active ? SQ.ink : SQ.slate,
                        flex: 1,
                      }}
                    >
                      {it.label}
                    </span>
                    {showLive ? (
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 9,
                          letterSpacing: ".14em",
                          color: SQ.sidebar,
                          background: SQ.red,
                          padding: "2px 7px",
                          borderRadius: 9,
                          fontWeight: 700,
                        }}
                      >
                        LIVE
                      </span>
                    ) : badge ? (
                      <span
                        style={
                          isSoftBadge
                            ? {
                                fontFamily: FONT.mono,
                                fontSize: 10,
                                color: SQ.amber,
                                background: "transparent",
                                border: "1px solid rgba(181,131,26,.5)",
                                padding: "1px 5px",
                                borderRadius: 9,
                                fontWeight: 700,
                              }
                            : {
                                fontFamily: FONT.mono,
                                fontSize: 10,
                                color: SQ.sidebar,
                                background: SQ.red,
                                padding: "2px 6px",
                                borderRadius: 9,
                                fontWeight: 700,
                              }
                        }
                      >
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* real admin identity + sign out */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: `1px solid ${SQ.hairline}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Link
            href="/admin/profile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
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
            <div style={{ lineHeight: 1.2, flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.name ?? "Admin"}
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: ".1em", color: SQ.label }}>
                LEAGUE ADMIN
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setConfirmOut(true)}
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: SQ.mute,
              background: "transparent",
              border: `1px solid ${SQ.inputBorder}`,
              padding: "8px 10px",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <ConfirmModal
        open={confirmOut}
        title="Sign out?"
        message="You'll be returned to the sign-in screen and need to sign in again to access the admin console."
        confirmLabel="Sign out"
        onConfirm={() => {
          setConfirmOut(false);
          onLogout();
        }}
        onClose={() => setConfirmOut(false)}
      />

      {/* ===== MAIN ===== */}
      <div style={{ flex: "1 1 560px", minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* top bar */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            // Fixed height matching the sidebar logo header so the two bottom borders align; horizontal
            // clamp matches the <main> content (…,32px) so the season label lines up with the page start.
            minHeight: 60,
            boxSizing: "border-box",
            padding: "0 clamp(16px,3vw,32px)",
            background: SQ.navBgAdmin,
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${SQ.hairline}`,
          }}
        >
          <div style={{ ...monoTiny, color: SQ.mute }}>{seasonLabel}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href={playerId ? playerHref(gamerTag ?? playerId) : "/"}
              title="Switch to the public player site"
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: SQ.mute,
                textDecoration: "none",
                border: `1px solid ${SQ.hairline}`,
                borderRadius: 999,
                padding: "6px 12px",
                whiteSpace: "nowrap",
              }}
            >
              ◂ Player site
            </Link>
            <NotificationBell href="/admin/notifications" />
            <ThemeToggle />
            <Link
              href="/admin/profile"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                textDecoration: "none",
                color: SQ.sidebar,
                background: SQ.red,
                padding: "8px 14px",
                borderRadius: 5,
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {user?.name ?? "League Admin"}
            </Link>
          </div>
        </div>

        <main style={{ padding: "clamp(22px,3vw,34px) clamp(16px,3vw,32px) 70px", flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
