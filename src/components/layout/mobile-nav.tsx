"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Gavel, Users, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/games/valorant", label: "Games", icon: Radio },
  { href: "/auction/live-2026", label: "Auction", icon: Gavel },
  { href: "/tournaments/vct-champions-2026", label: "Events", icon: Trophy },
  { href: "/leaderboards", label: "Ranks", icon: Users },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-bg-base/85 backdrop-blur-2xl md:hidden">
      <ul className="grid grid-cols-5 px-2">
        {items.map((it) => {
          const active =
            it.href === "/"
              ? pathname === "/"
              : pathname.startsWith(it.href.split("/").slice(0, 2).join("/"));
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-[10.5px] font-semibold transition-colors",
                  active ? "text-neon-electric" : "text-ink-muted",
                )}
              >
                <it.icon className="h-5 w-5" />
                {it.label}
                {active && (
                  <span className="h-0.5 w-6 rounded-full bg-neon-gradient" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
