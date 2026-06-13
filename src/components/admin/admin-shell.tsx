"use client";

import type { ReactNode, CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SQ, FONT } from "./tokens";

interface NavItem {
  href: string;
  label: string;
  badge?: string;
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
      { href: "/admin/matches", label: "Matches" },
      { href: "/admin/registrations", label: "Registrations", badge: "14" },
    ],
  },
  {
    label: "ENTITIES",
    items: [
      { href: "/admin/franchises", label: "Franchises" },
      { href: "/admin/players", label: "Players" },
      { href: "/admin/games", label: "Games" },
    ],
  },
  { label: "COMMS", items: [{ href: "/admin/announcements", label: "Announcements" }] },
  { label: "SYSTEM", items: [{ href: "/admin/settings", label: "Settings" }] },
];

const monoTiny: CSSProperties = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".14em",
};

export function AdminShell({
  children,
  fontClass,
}: {
  children: ReactNode;
  fontClass: string;
}) {
  const pathname = usePathname() ?? "/admin";
  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(href + "/");

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
            padding: "20px 22px",
            borderBottom: `1px solid ${SQ.hairline}`,
            display: "flex",
            alignItems: "center",
            gap: 11,
            textDecoration: "none",
            color: SQ.ink,
          }}
        >
          <div style={{ width: 13, height: 13, background: SQ.red, transform: "rotate(45deg)" }} />
          <span style={{ fontFamily: FONT.display, fontSize: 17, letterSpacing: ".005em" }}>
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
              {grp.items.map((it) => {
                const active = isActive(it.href);
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
                      background: active ? "rgba(255,61,46,.12)" : "transparent",
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 2,
                        background: active ? SQ.red : "#3a3d46",
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
                    {it.badge ? (
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10,
                          color: SQ.sidebar,
                          background: SQ.red,
                          padding: "2px 6px",
                          borderRadius: 9,
                          fontWeight: 700,
                        }}
                      >
                        {it.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "16px 18px",
            borderTop: `1px solid ${SQ.hairline}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#3a3d46,#1c1e24)",
              border: `1px solid ${SQ.inputBorder}`,
            }}
          />
          <div style={{ lineHeight: 1.2, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Dev Mehta</div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                letterSpacing: ".1em",
                color: SQ.label,
              }}
            >
              LEAGUE ADMIN
            </div>
          </div>
        </div>
      </aside>

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
            padding: "13px clamp(16px,3vw,28px)",
            background: "rgba(11,12,15,.92)",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${SQ.hairline}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...monoTiny, color: SQ.mute }}>SEASON 04 — SPRING</div>
            <span style={{ color: "#3a3d46" }}>/</span>
            <div style={{ ...monoTiny, color: SQ.ember, display: "flex", alignItems: "center", gap: 7 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: SQ.red,
                  animation: "sqpulse 1.4s infinite",
                }}
              />
              REGISTRATION OPEN
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".1em",
                color: SQ.mute,
                border: `1px solid ${SQ.inputBorder}`,
                padding: "8px 13px",
                borderRadius: 5,
                whiteSpace: "nowrap",
              }}
            >
              SEARCH ⌘K
            </div>
            <Link
              href="/admin/matches"
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: SQ.sidebar,
                background: SQ.red,
                padding: "9px 15px",
                borderRadius: 5,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              + Create
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
