import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { gameById, games } from "@/lib/mock/games";
import { playersByGame } from "@/lib/mock/players";
import { tournaments } from "@/lib/mock/tournaments";
import { franchises } from "@/lib/mock/franchises";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/common/section";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, formatCompact, formatCurrency } from "@/lib/utils";
import { LiveIndicator } from "@/components/common/live-indicator";
import { Trophy, Users, Calendar } from "lucide-react";

export function generateStaticParams() {
  return games.map((g) => ({ game: g.id }));
}

export default async function GameHubPage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  const g = gameById(game);
  if (!g) return notFound();

  const gamePlayers = playersByGame(g.id);
  const gameTournaments = tournaments.filter((t) => t.game === g.id);
  const gameFranchises = franchises.filter((f) => f.game === g.id);

  return (
    <>
      {/* Hero banner */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src={g.cover}
            alt={g.name}
            fill
            sizes="100vw"
            className="object-cover opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-bg-base/60 via-bg-base/85 to-bg-base" />
        </div>
        <div className="grid-overlay absolute inset-0 -z-10 opacity-50" />

        <div className="container py-16 md:py-24">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neon">Game hub</Badge>
            <Badge variant="purple">{g.tagline}</Badge>
          </div>
          <h1 className="mt-5 font-display text-5xl font-bold tracking-tight md:text-7xl">
            <span className="text-gradient">{g.name}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-ink-muted md:text-lg">
            Rankings, tournaments, meta stats, and analytics for the {g.name}{" "}
            scene. Updated in real time.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Players", formatCompact(g.players), Users],
              ["Tournaments", g.tournaments.toString(), Trophy],
              ["Active leagues", "12", Calendar],
              ["Live now", "4", Users],
            ].map(([k, v, Icon]) => (
              <div
                key={k as string}
                className="panel flex items-center gap-3 p-4"
              >
                <Icon className="h-5 w-5 text-neon-electric" />
                <div>
                  <p className="text-[10.5px] uppercase tracking-widest text-ink-dim">
                    {k as string}
                  </p>
                  <p className="stat-num text-lg font-bold text-ink">
                    {v as string}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container">
        <Tabs defaultValue="rankings">
          <TabsList>
            <TabsTrigger value="rankings">Rankings</TabsTrigger>
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="meta">Meta</TabsTrigger>
          </TabsList>

          <TabsContent value="rankings">
            <div className="panel divide-y divide-white/[0.05]">
              {gamePlayers.slice(0, 10).map((p, i) => (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="grid grid-cols-[40px_1.5fr_1fr_1fr_1fr_1fr] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="stat-num text-xl font-bold text-ink-dim">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={p.avatar} alt={p.handle} />
                      <AvatarFallback>{initials(p.handle)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-ink truncate">
                        {p.handle} <span className="ml-1">{p.countryCode}</span>
                      </p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {p.role}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-ink-muted">K/D {p.kd}</span>
                  <span className="text-xs text-ink-muted">
                    HS% {p.hsPct}
                  </span>
                  <span className="text-xs text-ink-muted">
                    Win {p.winRate}%
                  </span>
                  <span className="stat-num text-right text-base font-bold text-gradient">
                    {p.rating}
                  </span>
                </Link>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tournaments">
            <div className="grid gap-3 md:grid-cols-2">
              {gameTournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="panel p-5 transition-all hover:-translate-y-0.5 hover:border-white/15"
                >
                  <div className="flex items-center gap-2">
                    {t.status === "live" ? (
                      <LiveIndicator />
                    ) : (
                      <Badge variant="neon">{t.status}</Badge>
                    )}
                    <Badge>{t.format.replace("-", " ")}</Badge>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-ink">
                    {t.name}
                  </h3>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xs text-ink-muted">
                      {t.teamCount} teams · {t.region}
                    </span>
                    <span className="stat-num text-base font-bold text-gradient">
                      {formatCurrency(t.prizePool)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="teams">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {gameFranchises.map((f) => (
                <Link
                  key={f.id}
                  href={`/franchises/${f.id}`}
                  className="panel p-5 transition-all hover:-translate-y-0.5 hover:border-white/15"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg border border-white/10"
                      style={{
                        background: `${f.primaryColor}22`,
                        boxShadow: `0 0 18px -6px ${f.primaryColor}`,
                      }}
                    />
                    <div>
                      <p className="font-display text-sm font-bold text-ink">
                        {f.name}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {f.region} · #{f.ranking}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-ink-dim">Wins</p>
                      <p className="stat-num text-base font-bold text-ink">
                        {f.wins}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-dim">Trophies</p>
                      <p className="stat-num text-base font-bold text-ink">
                        {f.trophies}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-dim">Roster</p>
                      <p className="stat-num text-base font-bold text-ink">
                        {f.rosterSize}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="meta">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[
                ["Jett", 24.3, "Duelist"],
                ["Omen", 18.1, "Controller"],
                ["Sova", 15.6, "Initiator"],
                ["Killjoy", 12.8, "Sentinel"],
                ["Cypher", 9.2, "Sentinel"],
                ["Phoenix", 6.7, "Duelist"],
              ].map(([name, pick, role]) => (
                <div key={name as string} className="panel p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display text-base font-bold text-ink">
                        {name}
                      </p>
                      <p className="text-xs text-ink-muted">{role}</p>
                    </div>
                    <span className="stat-num text-2xl font-bold text-gradient">
                      {pick}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-neon-electric to-neon-purple"
                      style={{ width: `${Math.min(100, (pick as number) * 3)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10.5px] uppercase tracking-widest text-ink-dim">
                    Pick rate · last 30d
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}
