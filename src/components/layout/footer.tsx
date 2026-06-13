import Link from "next/link";
import { Logo } from "./logo";

const sections = [
  {
    title: "Platform",
    links: [
      ["Games", "/games/valorant"],
      ["Tournaments", "/tournaments/vct-champions-2026"],
      ["Auctions", "/auction/live-2026"],
      ["Rankings", "/leaderboards"],
    ],
  },
  {
    title: "Operate",
    links: [
      ["Franchise dashboard", "/franchises/sentinels-cipher"],
      ["Player profiles", "/players/nyx"],
      ["Analytics", "/leaderboards"],
      ["Admin", "/admin"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/"],
      ["Press", "/"],
      ["Careers", "/"],
      ["Status", "/"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms", "/"],
      ["Privacy", "/"],
      ["Anti-cheat", "/"],
      ["Cookie policy", "/"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-16 border-t border-white/[0.05] bg-gradient-to-b from-transparent to-black/40">
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-ink-muted">
              The infrastructure layer for modern esports — tournaments,
              franchises, auctions, and analytics in one platform.
            </p>
            <p className="mt-6 text-xs text-ink-dim">
              © {new Date().getFullYear()} Esports Arena, Inc.
            </p>
          </div>
          {sections.map((s) => (
            <div key={s.title}>
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-dim">
                {s.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {s.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
