"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SQ, FONT } from "./tokens";

const navLinks = [
  { key: "home", label: "Home", href: "/league" },
  { key: "games", label: "Games", href: "/league/games" },
  { key: "franchises", label: "Franchises", href: "/league/franchises" },
  { key: "players", label: "Players", href: "/league/players" },
  { key: "match", label: "History", href: "/league/match" },
  { key: "announcements", label: "Announcements", href: "/league/announcements" },
];

function activeKey(pathname: string): string {
  if (pathname === "/league") return "home";
  if (pathname.startsWith("/league/games")) return "games";
  if (pathname.startsWith("/league/franchise")) return "franchises"; // franchises + franchise
  if (pathname.startsWith("/league/player")) return "players"; // players + player
  if (pathname.startsWith("/league/match")) return "match";
  if (pathname.startsWith("/league/announcements")) return "announcements";
  return "home";
}

export function LeagueShell({
  children,
  fontClass,
}: {
  children: ReactNode;
  fontClass: string;
}) {
  const pathname = usePathname() ?? "/league";
  const cur = activeKey(pathname);

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
          background: "rgba(14,15,19,.92)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <Link
          href="/league"
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
            S04
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
          {navLinks.map((link) => {
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
              </Link>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/league/register"
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
            Register ▸
          </Link>
          <Link
            href="/league/player"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              cursor: "pointer",
              borderLeft: "1px solid rgba(255,255,255,.12)",
              paddingLeft: 14,
              textDecoration: "none",
              color: SQ.ink,
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
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Raghavan</div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  letterSpacing: ".1em",
                  color: SQ.label,
                }}
              >
                RXG · IGL
              </div>
            </div>
          </Link>
        </div>
      </nav>

      <main
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "clamp(24px,4vw,40px) clamp(16px,4vw,30px) 80px",
        }}
      >
        {children}

        {/* footer */}
        <div
          style={{
            marginTop: 64,
            paddingTop: 22,
            borderTop: `1px solid ${SQ.hairline}`,
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
          <div>SEASON 04 — SPRING SERIES · BUILT FOR THE FRANCHISES</div>
        </div>
      </main>
    </div>
  );
}
