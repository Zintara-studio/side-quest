"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Gavel, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveIndicator } from "@/components/common/live-indicator";
import { Countdown } from "@/components/common/countdown";

export function AuctionBanner() {
  const target = new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString();

  return (
    <section className="container py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true, margin: "-15%" }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neon-purple/15 via-bg-panel to-neon-electric/15 p-8 md:p-12"
      >
        <div className="absolute inset-0 grid-overlay opacity-30" />
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-neon-pink/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-neon-electric/25 blur-3xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <LiveIndicator label="Auction · Round 3" />
              <span className="chip">
                <Sparkles className="h-3 w-3 text-neon-electric" /> 18 franchises bidding
              </span>
            </div>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
              The <span className="text-gradient">Global Auction</span><br />
              is in session.
            </h2>
            <p className="mt-4 max-w-xl text-sm text-ink-muted md:text-base">
              Pro players, real-time bids, locked wallets, and a fully-broadcast
              draft room. Tune in to watch contracts get rewritten live.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/auction/live-2026">
                  Enter auction room <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline">
                <Gavel className="h-4 w-4" /> View schedule
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-bg-base/60 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-widest text-ink-dim">
              Next round opens in
            </p>
            <Countdown to={target} className="mt-3" />
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="uppercase tracking-widest text-ink-dim">
                  Pot value
                </p>
                <p className="stat-num mt-1 text-lg font-bold text-ink">
                  $42.8M
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="uppercase tracking-widest text-ink-dim">
                  Players
                </p>
                <p className="stat-num mt-1 text-lg font-bold text-ink">128</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="uppercase tracking-widest text-ink-dim">
                  Top bid
                </p>
                <p className="stat-num mt-1 text-lg font-bold text-neon-pink">
                  $1.275M
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="uppercase tracking-widest text-ink-dim">
                  Lots left
                </p>
                <p className="stat-num mt-1 text-lg font-bold text-ink">37</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
