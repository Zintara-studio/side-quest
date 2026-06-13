import { notFound } from "next/navigation";
import Image from "next/image";
import { tournamentById, tournaments } from "@/lib/mock/tournaments";
import { matches } from "@/lib/mock/matches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveIndicator } from "@/components/common/live-indicator";
import { Countdown } from "@/components/common/countdown";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Calendar, Globe, Trophy, Tv } from "lucide-react";
import { Bracket } from "@/components/tournament/bracket";

export function generateStaticParams() {
  return tournaments.map((t) => ({ id: t.id }));
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = tournamentById(id);
  if (!t) return notFound();
  const tMatches = matches.filter((m) => m.tournamentId === t.id);

  return (
    <>
      <section className="relative isolate">
        <div className="relative h-72 w-full overflow-hidden md:h-96">
          <Image
            src={t.cover}
            alt={t.name}
            fill
            priority
            className="object-cover opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/70 to-transparent" />
          <div className="grid-overlay absolute inset-0 opacity-40" />
        </div>

        <div className="container -mt-44 relative pb-6 md:-mt-56">
          <div className="flex flex-wrap items-center gap-2">
            {t.status === "live" ? (
              <LiveIndicator label="LIVE NOW" />
            ) : (
              <Badge variant="neon">{t.status}</Badge>
            )}
            <Badge variant="purple">{t.game}</Badge>
            <Badge>{t.format.replace("-", " ")}</Badge>
            <Badge variant="warning">{t.organizer}</Badge>
          </div>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-tight md:text-7xl">
            <span className="text-gradient">{t.name}</span>
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-4 w-4" /> {t.region}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(t.startsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              –{" "}
              {new Date(t.endsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-neon-amber" />
              <span className="stat-num text-base font-bold text-gradient">
                {formatCurrency(t.prizePool)}
              </span>
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button>
              <Tv className="h-4 w-4" /> Watch broadcast
            </Button>
            <Button variant="outline">View bracket</Button>
            {t.status === "upcoming" && (
              <div className="ml-2 hidden md:block">
                <Countdown to={t.startsAt} compact />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="container mt-6">
        <Tabs defaultValue="bracket">
          <TabsList>
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="mvp">MVP race</TabsTrigger>
          </TabsList>

          <TabsContent value="bracket">
            <Card>
              <CardHeader>
                <CardTitle>Playoff bracket</CardTitle>
              </CardHeader>
              <CardContent>
                <Bracket />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <div className="panel divide-y divide-white/[0.05]">
              {(tMatches.length ? tMatches : matches.slice(0, 5)).map((m) => (
                <div
                  key={m.id}
                  className="grid grid-cols-[80px_1fr_60px_1fr_60px] items-center gap-3 px-5 py-3 text-sm"
                >
                  <span className="text-xs text-ink-muted">
                    {new Date(m.scheduledAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-right font-semibold text-ink truncate">
                    {m.teamA.name}
                  </span>
                  <span className="stat-num text-center text-ink">
                    {m.teamA.score} – {m.teamB.score}
                  </span>
                  <span className="text-left font-semibold text-ink truncate">
                    {m.teamB.name}
                  </span>
                  <span className="text-right">
                    {m.status === "live" ? (
                      <LiveIndicator />
                    ) : (
                      <span className="text-[10.5px] uppercase tracking-widest text-ink-dim">
                        BO{m.bestOf}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="standings">
            <div className="panel divide-y divide-white/[0.05]">
              {[
                ["Sentinels Cipher", 12, 2, 36],
                ["Neon Dynasty", 11, 3, 33],
                ["Hyperion", 10, 4, 30],
                ["Arc Titans", 8, 6, 24],
                ["Phantom Corps", 6, 8, 18],
                ["Void Pulse", 5, 9, 15],
              ].map(([name, w, l, pts], i) => (
                <div
                  key={name as string}
                  className="grid grid-cols-[30px_1fr_60px_60px_80px] items-center gap-3 px-5 py-3 text-sm"
                >
                  <span className="stat-num text-ink-dim">{i + 1}</span>
                  <span className="font-semibold text-ink">{name as string}</span>
                  <span className="text-center text-neon-lime">{w}</span>
                  <span className="text-center text-neon-red">{l}</span>
                  <span className="stat-num text-right text-base font-bold text-gradient">
                    {pts}
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="mvp">
            <div className="grid gap-3 md:grid-cols-3">
              {["nyx", "asphalt", "vortex"].map((h, i) => (
                <Card key={h}>
                  <CardHeader>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-neon-amber">
                      <Trophy className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle>{h}</CardTitle>
                      <p className="text-xs text-ink-muted">MVP rating</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="stat-num text-3xl font-bold text-gradient">
                      {(1.42 - i * 0.05).toFixed(2)}
                    </p>
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
