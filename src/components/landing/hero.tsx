"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play, Sparkles, Trophy, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveIndicator } from "@/components/common/live-indicator";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="grid-overlay pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-neon-electric/50 to-transparent" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-radial-glow blur-2xl" />

      <div className="container relative pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-ink-muted backdrop-blur"
            >
              <Sparkles className="h-3.5 w-3.5 text-neon-electric" />
              Now powering <span className="text-ink">14 leagues</span> · Season
              2026 live
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight md:text-7xl"
            >
              The operating <br />
              <span className="text-gradient">system</span> for esports.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="mt-6 max-w-xl text-base text-ink-muted md:text-lg"
            >
              Tournaments, franchises, live auctions, rankings, and analytics —
              built for the next decade of competitive gaming. One platform,
              every game.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" asChild>
                <Link href="/signup">
                  Start your franchise <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auction/live-2026">
                  <Gavel className="h-4 w-4" /> Watch live auction
                </Link>
              </Button>
              <Button size="lg" variant="ghost">
                <Play className="h-4 w-4" /> 90s demo
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-10 grid grid-cols-3 gap-6 border-t border-white/[0.06] pt-6 md:max-w-md"
            >
              {[
                ["1.2M", "Active players"],
                ["480+", "Tournaments"],
                ["$58M", "Prize pool"],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="stat-num text-2xl font-bold text-ink md:text-3xl">
                    {v}
                  </p>
                  <p className="text-[11px] uppercase tracking-widest text-ink-dim">
                    {l}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right visual: stacked broadcast card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-neon-gradient opacity-20 blur-3xl" />
            <div className="panel relative overflow-hidden">
              <div className="absolute inset-0 grid-overlay opacity-50" />
              <div className="relative p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <LiveIndicator label="LIVE · IEM Rio Major" />
                  <span className="font-mono text-xs text-ink-muted">
                    Quarterfinal · BO3
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <TeamPanel name="Phantom Corps" tag="PHC" color="#f59e0b" score={13} />
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">
                      MAP 2
                    </span>
                    <span className="stat-num text-3xl font-bold text-ink">
                      vs
                    </span>
                  </div>
                  <TeamPanel
                    name="Arc Titans"
                    tag="ARC"
                    color="#a3e635"
                    score={9}
                    align="right"
                  />
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
                  {[
                    ["Round", "22"],
                    ["Bombs", "07"],
                    ["MVP", "asphalt"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <p className="uppercase tracking-widest text-ink-dim">
                        {k}
                      </p>
                      <p className="stat-num mt-1 text-lg font-semibold text-ink">
                        {v}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <Trophy className="h-4 w-4 text-neon-amber" />
                    Prize pool
                  </div>
                  <p className="stat-num text-sm font-semibold text-ink">
                    $1,500,000
                  </p>
                </div>
              </div>

              {/* Floating bid card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute -bottom-6 -left-6 hidden w-64 md:block"
              >
                <div className="panel p-4">
                  <div className="flex items-center justify-between">
                    <Gavel className="h-4 w-4 text-neon-purple" />
                    <span className="text-[10px] uppercase tracking-widest text-ink-dim">
                      Live bid · 03:42
                    </span>
                  </div>
                  <p className="mt-2 stat-num text-2xl font-bold text-gradient">
                    $1,275,000
                  </p>
                  <p className="text-xs text-ink-muted">Sentinels Cipher bid</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function TeamPanel({
  name,
  tag,
  color,
  score,
  align = "left",
}: {
  name: string;
  tag: string;
  color: string;
  score: number;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-3 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10"
        style={{ background: `${color}22`, boxShadow: `0 0 24px -8px ${color}` }}
      >
        <span className="font-display text-sm font-bold" style={{ color }}>
          {tag}
        </span>
      </div>
      <div>
        <p className="font-display text-sm font-semibold text-ink">{name}</p>
        <p className="stat-num text-3xl font-bold text-ink">{score}</p>
      </div>
    </div>
  );
}
