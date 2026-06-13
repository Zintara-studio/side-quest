"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { players } from "@/lib/mock/players";
import { games } from "@/lib/mock/games";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { initials, formatCurrency, cn } from "@/lib/utils";
import { Search, TrendingUp, ArrowUpDown } from "lucide-react";

type SortKey = "rating" | "kd" | "winRate" | "earnings" | "matchesPlayed";

export default function LeaderboardsPage() {
  const [q, setQ] = useState("");
  const [game, setGame] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return players
      .filter(
        (p) =>
          (game === "all" || p.game === game) &&
          (ql === "" ||
            p.handle.toLowerCase().includes(ql) ||
            p.realName.toLowerCase().includes(ql)),
      )
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        return (a[sortKey] - b[sortKey]) * dir;
      });
  }, [q, game, sortKey, sortDir]);

  const Header = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => {
        if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
          setSortKey(k);
          setSortDir("desc");
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-widest transition-colors",
        sortKey === k ? "text-neon-electric" : "text-ink-dim hover:text-ink",
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <section className="container py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neon-electric">
            Power Index
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Global rankings
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Computed weekly across 14 stat dimensions. Filter, sort, and compare
            the world's best.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by handle or name"
            className="w-72 pl-9"
          />
        </div>
      </div>

      <Tabs value={game} onValueChange={setGame} className="mt-8">
        <TabsList>
          <TabsTrigger value="all">All games</TabsTrigger>
          {games.map((g) => (
            <TabsTrigger key={g.id} value={g.id}>
              {g.name}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={game} forceMount>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {["All", "NA", "EMEA", "APAC", "LATAM"].map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r === "All" ? "all" : r)}
                className={cn(
                  "rounded-full border px-3 py-1 transition-colors",
                  (region === "all" && r === "All") || region === r
                    ? "border-neon-electric/50 bg-neon-electric/10 text-neon-electric"
                    : "border-white/10 bg-white/[0.03] text-ink-muted hover:text-ink hover:border-white/20",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="panel mt-4 overflow-hidden">
            <div className="grid grid-cols-[40px_1.6fr_80px_80px_80px_100px_100px_80px] items-center gap-3 border-b border-white/[0.05] px-5 py-3">
              <span className="text-[10.5px] uppercase tracking-widest text-ink-dim">
                #
              </span>
              <span className="text-[10.5px] uppercase tracking-widest text-ink-dim">
                Player
              </span>
              <Header k="rating" label="Rating" />
              <Header k="kd" label="K/D" />
              <Header k="winRate" label="Win %" />
              <Header k="matchesPlayed" label="Matches" />
              <Header k="earnings" label="Earnings" />
              <span className="text-right text-[10.5px] uppercase tracking-widest text-ink-dim">
                Trend
              </span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {filtered.slice(0, 40).map((p, i) => (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="grid grid-cols-[40px_1.6fr_80px_80px_80px_100px_100px_80px] items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="stat-num text-sm font-bold text-ink-dim">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={p.avatar} />
                      <AvatarFallback>{initials(p.handle)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-ink truncate">
                        {p.handle} <span className="ml-1">{p.countryCode}</span>
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="purple">{p.game}</Badge>
                        <span className="text-[10.5px] text-ink-muted">
                          {p.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="stat-num text-sm font-bold text-gradient">
                    {p.rating}
                  </span>
                  <span className="stat-num text-sm text-ink">{p.kd}</span>
                  <span className="stat-num text-sm text-ink">{p.winRate}%</span>
                  <span className="stat-num text-sm text-ink-muted">
                    {p.matchesPlayed}
                  </span>
                  <span className="stat-num text-sm text-ink-muted">
                    {formatCurrency(p.earnings)}
                  </span>
                  <span className="inline-flex items-center justify-end gap-1 text-xs text-neon-lime">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {((p.rating - 1) * 10).toFixed(1)}
                  </span>
                </Link>
              ))}
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-ink-muted">
                  No players match those filters.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
