import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { playerById, players } from "@/lib/mock/players";
import { franchiseById } from "@/lib/mock/franchises";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  initials,
  formatCurrency,
  formatCompact,
} from "@/lib/utils";
import { Heart, GitCompareArrows, Twitch, Twitter, Youtube, Award, Trophy } from "lucide-react";
import { PerformanceChart } from "@/components/player/performance-chart";
import { PlayerRadar } from "@/components/player/radar";

export function generateStaticParams() {
  return players.map((p) => ({ id: p.id }));
}

const statusStyles: Record<string, { label: string; variant: any }> = {
  signed: { label: "Signed", variant: "success" },
  "free-agent": { label: "Free Agent", variant: "warning" },
  loaned: { label: "Loaned", variant: "purple" },
  benched: { label: "Benched", variant: "default" },
  retired: { label: "Retired", variant: "danger" },
};

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = playerById(id);
  if (!p) return notFound();
  const franchise = p.franchiseId ? franchiseById(p.franchiseId) : null;
  const status = statusStyles[p.status];

  const radarData = [
    { stat: "Aim", value: 90 - p.rank * 2 },
    { stat: "Util", value: 75 + (p.rank % 4) * 3 },
    { stat: "Clutch", value: 82 - p.rank },
    { stat: "Game IQ", value: 88 - p.rank },
    { stat: "Mechanics", value: 85 - p.rank * 1.5 },
    { stat: "Movement", value: 78 + (p.rank % 5) },
  ];

  return (
    <>
      {/* Banner */}
      <section className="relative isolate">
        <div className="relative h-64 w-full overflow-hidden md:h-80">
          <Image
            src={p.banner}
            alt={p.handle}
            fill
            priority
            className="object-cover opacity-50"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/70 to-transparent" />
          <div className="grid-overlay absolute inset-0 opacity-40" />
        </div>

        <div className="container -mt-24 relative">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-neon-gradient opacity-50 blur-xl" />
              <Avatar className="relative h-32 w-32 rounded-3xl ring-2 ring-white/10">
                <AvatarImage src={p.avatar} alt={p.handle} />
                <AvatarFallback className="rounded-3xl text-3xl">
                  {initials(p.handle)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status.variant}>{status.label}</Badge>
                <Badge variant="neon">{p.game}</Badge>
                <Badge variant="purple">#{p.rank} world</Badge>
              </div>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
                {p.handle} <span className="ml-2">{p.countryCode}</span>
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                {p.realName} · {p.role} · age {p.age}
                {franchise && (
                  <>
                    {" · "}
                    <Link
                      href={`/franchises/${franchise.id}`}
                      className="text-neon-electric hover:underline"
                    >
                      {franchise.name}
                    </Link>
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary">
                <Heart className="h-4 w-4" /> Follow ·{" "}
                {formatCompact(p.followers)}
              </Button>
              <Button variant="secondary">
                <GitCompareArrows className="h-4 w-4" /> Compare
              </Button>
              <Button variant="ghost" size="icon" aria-label="Twitch">
                <Twitch className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Twitter">
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="YouTube">
                <Youtube className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-12">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            ["Rating", p.rating, "gradient"],
            ["K/D", p.kd, "ink"],
            ["ACS", p.acs, "ink"],
            ["HS %", `${p.hsPct}%`, "ink"],
            ["Win %", `${p.winRate}%`, "ink"],
            ["MVPs", p.mvpCount, "ink"],
          ].map(([k, v, c]) => (
            <div key={k as string} className="panel p-4">
              <p className="text-[10.5px] uppercase tracking-widest text-ink-dim">
                {k as string}
              </p>
              <p
                className={
                  c === "gradient"
                    ? "stat-num mt-1 text-3xl font-bold text-gradient"
                    : "stat-num mt-1 text-3xl font-bold text-ink"
                }
              >
                {v as string | number}
              </p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="overview" className="mt-10">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="career">Career</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Performance · last 12 weeks</CardTitle>
                </CardHeader>
                <CardContent>
                  <PerformanceChart seed={p.handle.length + p.rank} />
                  <div className="mt-4 flex items-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-neon-electric">
                      <span className="h-2 w-2 rounded-full bg-neon-electric" />
                      Rating
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-neon-purple">
                      <span className="h-2 w-2 rounded-full bg-neon-purple" />
                      Impact
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Strengths</CardTitle>
                </CardHeader>
                <CardContent>
                  <PlayerRadar data={radarData} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contract</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row k="Signed since" v={p.signedYear?.toString() ?? "—"} />
                  <Row k="Earnings" v={formatCurrency(p.earnings)} />
                  <Row k="Matches" v={p.matchesPlayed.toString()} />
                  <Row k="Buyout" v={formatCurrency(p.earnings * 4)} />
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Map proficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      ["Ascent", 78],
                      ["Bind", 64],
                      ["Haven", 81],
                      ["Lotus", 55],
                      ["Sunset", 72],
                    ].map(([m, w]) => (
                      <div key={m as string}>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-ink">{m}</span>
                          <span className="stat-num text-ink-muted">
                            {w}% win
                          </span>
                        </div>
                        <Progress value={w as number} className="mt-1.5 h-1.5" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="matches">
            <div className="panel divide-y divide-white/[0.05]">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[80px_1fr_60px_60px_60px] items-center gap-3 px-5 py-3 text-sm"
                >
                  <span className="text-xs text-ink-muted">
                    {i + 1}d ago
                  </span>
                  <div className="flex items-center gap-2 text-ink">
                    vs{" "}
                    <span className="font-semibold">
                      {["Phantom Corps", "Arc Titans", "Neon Dynasty", "Void Pulse"][i % 4]}
                    </span>
                  </div>
                  <span
                    className={
                      i % 3 === 0
                        ? "text-neon-red font-semibold"
                        : "text-neon-lime font-semibold"
                    }
                  >
                    {i % 3 === 0 ? "L" : "W"}
                  </span>
                  <span className="stat-num text-ink">
                    {(p.kd + (i % 3) * 0.1).toFixed(2)}
                  </span>
                  <span className="stat-num text-ink-muted text-right">
                    {p.acs - i * 4}
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="career">
            <div className="panel p-6">
              <ol className="relative space-y-6 border-l border-white/[0.08] pl-6">
                {[
                  ["2026", franchise?.name ?? "Free Agent", "Current"],
                  ["2024", "Neon Dynasty Academy", "Promoted"],
                  ["2023", "Tier 2 Open Circuit", "MVP"],
                  ["2022", "Amateur Cup", "Champion"],
                ].map(([year, team, note], i) => (
                  <li key={`${year}-${i}`} className="relative">
                    <span className="absolute -left-[31px] mt-1 inline-block h-3 w-3 rounded-full bg-neon-electric shadow-[0_0_12px_-2px_rgba(0,229,255,0.7)]" />
                    <p className="text-xs font-mono uppercase tracking-widest text-ink-dim">
                      {year}
                    </p>
                    <p className="mt-0.5 font-display text-base font-semibold text-ink">
                      {team}
                    </p>
                    <p className="text-xs text-ink-muted">{note}</p>
                  </li>
                ))}
              </ol>
            </div>
          </TabsContent>

          <TabsContent value="achievements">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[
                ["VCT Champions MVP", "2025", Trophy],
                ["1st place · Regional Masters", "2024", Trophy],
                ["MVP of the year", "2024", Award],
                ["100K elims milestone", "2023", Award],
                ["Top 10 Power Index", "2023", Award],
                ["Rookie of the year", "2022", Award],
              ].map(([t, y, Icon], i) => (
                <div key={i} className="panel p-5">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 text-neon-amber" />
                    <div>
                      <p className="font-display text-sm font-bold text-ink">
                        {t as string}
                      </p>
                      <p className="text-xs text-ink-muted">{y as string}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-ink-muted">{k}</span>
      <span className="stat-num text-sm font-semibold text-ink">{v}</span>
    </div>
  );
}
