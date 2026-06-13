import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { franchiseById, franchises } from "@/lib/mock/franchises";
import { playersByFranchise } from "@/lib/mock/players";
import { matches as allMatches } from "@/lib/mock/matches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { initials, formatCurrency, pct } from "@/lib/utils";
import {
  Trophy, Wallet, Users, BarChart3, UserPlus, Settings, FileText, Gavel,
} from "lucide-react";
import { PerformanceChart } from "@/components/player/performance-chart";

export function generateStaticParams() {
  return franchises.map((f) => ({ id: f.id }));
}

export default async function FranchisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const f = franchiseById(id);
  if (!f) return notFound();

  const roster = playersByFranchise(f.id);
  const recent = allMatches
    .filter((m) => m.teamA.id === f.id || m.teamB.id === f.id)
    .slice(0, 5);
  const winPct = pct(f.wins, f.wins + f.losses);
  const walletPct = pct(f.walletBalance, f.budget);

  return (
    <>
      {/* Header */}
      <section className="relative isolate">
        <div className="relative h-56 w-full overflow-hidden md:h-72">
          <Image
            src={f.banner}
            alt={f.name}
            fill
            priority
            className="object-cover opacity-40"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/70 to-transparent" />
          <div
            className="absolute inset-0 opacity-25"
            style={{
              background: `radial-gradient(60% 80% at 30% 30%, ${f.primaryColor}55, transparent 70%)`,
            }}
          />
          <div className="grid-overlay absolute inset-0 opacity-40" />
        </div>

        <div className="container -mt-20 relative">
          <div className="flex flex-col items-start gap-5 md:flex-row md:items-end">
            <div
              className="h-24 w-24 rounded-2xl border border-white/10 shadow-2xl md:h-28 md:w-28"
              style={{
                background: `${f.primaryColor}22`,
                boxShadow: `0 0 40px -8px ${f.primaryColor}`,
              }}
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neon">#{f.ranking} world</Badge>
                <Badge variant="purple">{f.game}</Badge>
                <Badge>{f.region}</Badge>
                <Badge variant="warning">Est. {f.founded}</Badge>
              </div>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
                <span className="text-ink">{f.name}</span>
                <span className="ml-3 text-ink-dim">/{f.tag}</span>
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">
                <UserPlus className="h-4 w-4" /> Invite player
              </Button>
              <Button variant="outline">
                <Gavel className="h-4 w-4" /> Open auction
              </Button>
              <Button variant="ghost" size="icon" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-10">
        {/* KPI row */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neon-amber">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Trophies</CardTitle>
                <p className="text-xs text-ink-muted">Career honors</p>
              </div>
            </CardHeader>
            <CardContent>
              <p className="stat-num text-4xl font-bold text-ink">
                {f.trophies}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                +2 this season
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neon-lime">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Win rate</CardTitle>
                <p className="text-xs text-ink-muted">
                  {f.wins}W · {f.losses}L
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <p className="stat-num text-4xl font-bold text-ink">{winPct}%</p>
              <Progress value={winPct} className="mt-3 h-1.5" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neon-electric">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Wallet</CardTitle>
                <p className="text-xs text-ink-muted">
                  Budget {formatCurrency(f.budget)}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <p className="stat-num text-3xl font-bold text-gradient">
                {formatCurrency(f.walletBalance)}
              </p>
              <Progress value={walletPct} className="mt-3 h-1.5" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neon-purple">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Roster</CardTitle>
                <p className="text-xs text-ink-muted">Active players</p>
              </div>
            </CardHeader>
            <CardContent>
              <p className="stat-num text-4xl font-bold text-ink">
                {f.rosterSize}
              </p>
              <p className="mt-1 text-xs text-ink-muted">2 free slots</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="roster" className="mt-8">
          <TabsList>
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="ops">Operations</TabsTrigger>
          </TabsList>

          <TabsContent value="roster">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(roster.length ? roster : []).map((p) => (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="panel group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:border-white/15"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={p.avatar} />
                    <AvatarFallback>{initials(p.handle)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm font-bold text-ink truncate">
                      {p.handle}{" "}
                      <span className="ml-1">{p.countryCode}</span>
                    </p>
                    <p className="text-[11px] text-ink-muted">{p.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="stat-num text-base font-bold text-gradient">
                      {p.rating}
                    </p>
                    <p className="text-[10.5px] uppercase tracking-widest text-ink-dim">
                      Rating
                    </p>
                  </div>
                </Link>
              ))}
              {roster.length === 0 && (
                <div className="panel p-8 text-center text-sm text-ink-muted lg:col-span-3">
                  No active players yet. Visit the auction to sign your first
                  star.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="matches">
            <div className="panel divide-y divide-white/[0.05]">
              {recent.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-ink-muted">
                  No recent matches.
                </div>
              )}
              {recent.map((m) => {
                const us = m.teamA.id === f.id ? m.teamA : m.teamB;
                const them = m.teamA.id === f.id ? m.teamB : m.teamA;
                const won = us.score > them.score;
                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[1fr_auto_1fr_60px] items-center gap-3 px-5 py-3 text-sm"
                  >
                    <span className="font-semibold text-ink truncate">
                      {us.name}
                    </span>
                    <span className="stat-num text-ink">
                      {us.score} – {them.score}
                    </span>
                    <span className="text-ink-muted truncate">{them.name}</span>
                    <span
                      className={
                        m.status === "live"
                          ? "text-neon-red font-semibold text-right"
                          : won
                            ? "text-neon-lime font-semibold text-right"
                            : "text-neon-red font-semibold text-right"
                      }
                    >
                      {m.status === "live" ? "LIVE" : won ? "W" : "L"}
                    </span>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Team form · last 12 weeks</CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceChart seed={f.tag.length + f.ranking} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ops">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[
                ["Contracts", "Review 3 pending offers", FileText],
                ["Scouting", "8 new prospect reports", Users],
                ["Sponsors", "$2.4M committed", Trophy],
                ["Trades", "1 trade request to approve", Gavel],
                ["Coaching", "Staff payroll under review", Settings],
                ["Compliance", "All checks green", BarChart3],
              ].map(([t, d, Icon], i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-neon-electric">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle>{t as string}</CardTitle>
                      <p className="text-xs text-ink-muted">{d as string}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button variant="secondary" size="sm">
                      Open
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}
