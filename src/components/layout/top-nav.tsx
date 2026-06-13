"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, Trophy, Gavel, Users, Radio, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { LiveIndicator } from "@/components/common/live-indicator";

const nav = [
  { href: "/games/valorant", label: "Games", icon: Radio },
  { href: "/tournaments/vct-champions-2026", label: "Tournaments", icon: Trophy },
  { href: "/auction/live-2026", label: "Auction", icon: Gavel, live: true },
  { href: "/leaderboards", label: "Rankings", icon: Users },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-bg-base/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-4">
        <Logo />

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href.split("/").slice(0, 2).join("/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-ink"
                    : "text-ink-muted hover:text-ink hover:bg-white/[0.04]",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.live && <LiveIndicator className="text-[9px]" />}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[17px] h-px bg-neon-gradient" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <input
              type="search"
              placeholder="Search players, teams, tournaments…"
              className="h-9 w-64 rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-16 text-sm text-ink placeholder:text-ink-dim transition-colors hover:border-white/20 focus:border-neon-electric/60 focus:outline-none focus:ring-2 focus:ring-neon-electric/30"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-ink-dim md:inline">
              ⌘K
            </kbd>
          </div>

          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>

          <Button variant="secondary" size="sm" asChild className="hidden md:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link href="/signup">
              Get started <ChevronDown className="h-3 w-3 -rotate-90" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
