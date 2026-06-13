"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { players } from "@/lib/mock/players";
import { franchises } from "@/lib/mock/franchises";
import { getMockSocket } from "@/lib/socket/mock-socket";
import type { BidEvent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveIndicator } from "@/components/common/live-indicator";
import { Countdown } from "@/components/common/countdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { Gavel, Sparkles, Send, Brain, Flame, Crown } from "lucide-react";

const ROUND_MS = 30_000;

export function AuctionRoom({ auctionId }: { auctionId: string }) {
  const [playerIdx, setPlayerIdx] = useState(0);
  const player = players[playerIdx];
  const [endsAt, setEndsAt] = useState(Date.now() + ROUND_MS);
  const [base] = useState(120_000);
  const [currentBid, setCurrentBid] = useState(base);
  const [topFranchiseId, setTopFranchiseId] = useState<string>(franchises[0].id);
  const [history, setHistory] = useState<BidEvent[]>([]);
  const [pulseKey, setPulseKey] = useState(0);
  const [chat, setChat] = useState<{ user: string; text: string; id: number }[]>([
    { user: "@kicker", text: "this man is going for the moon 🚀", id: 1 },
    { user: "@analyst", text: "AI says fair value $980K", id: 2 },
    { user: "@sen_fan", text: "SEN take him pls", id: 3 },
  ]);
  const [chatInput, setChatInput] = useState("");

  // simulated socket → bids
  useEffect(() => {
    const sock = getMockSocket();
    if (!sock) return;
    sock.start();
    const off = sock.on("bid:new", (ev: any) => {
      setCurrentBid((prev) => prev + ev.increment);
      setTopFranchiseId(ev.franchiseId);
      setHistory((h) =>
        [
          {
            id: `${ev.ts}-${Math.random()}`,
            ts: ev.ts,
            franchiseId: ev.franchiseId,
            franchiseTag: ev.franchiseTag,
            amount: 0,
          },
          ...h,
        ].slice(0, 30),
      );
      setPulseKey((k) => k + 1);
      setEndsAt((e) => Math.max(e, Date.now() + 5000));
    });
    return () => {
      off();
      sock.stop();
    };
  }, []);

  // history amounts (latest currentBid is freshest)
  const displayHistory = useMemo(() => {
    let amt = currentBid;
    return history.map((h, i) => {
      const out = { ...h, amount: amt };
      // each prior bid is smaller by a synthetic step
      amt = Math.max(base, amt - 25_000 - (i % 3) * 10_000);
      return out;
    });
  }, [history, currentBid, base]);

  // Round expiry → next player
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() >= endsAt) {
        setPlayerIdx((i) => (i + 1) % players.length);
        setCurrentBid(base);
        setHistory([]);
        setEndsAt(Date.now() + ROUND_MS);
      }
    }, 500);
    return () => clearInterval(id);
  }, [endsAt, base]);

  const topFranchise =
    franchises.find((f) => f.id === topFranchiseId) ?? franchises[0];

  const sendChat = () => {
    if (!chatInput.trim()) return;
    setChat((c) =>
      [
        ...c,
        { id: Date.now(), user: "@you", text: chatInput.trim() },
      ].slice(-50),
    );
    setChatInput("");
  };

  return (
    <section className="relative isolate">
      <div className="grid-overlay pointer-events-none absolute inset-0 opacity-40" />
      <div className="container py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LiveIndicator label="LIVE AUCTION · Round 3" />
            <Badge variant="purple">Lot {playerIdx + 1} of {players.length}</Badge>
            <Badge>{auctionId}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-ink-dim">
              Closes in
            </span>
            <Countdown to={new Date(endsAt).toISOString()} compact />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Player spotlight */}
          <div className="panel relative overflow-hidden">
            <Image
              src={player.banner}
              alt={player.handle}
              fill
              className="object-cover opacity-25"
              sizes="(max-width: 1024px) 100vw, 60vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-br from-bg-panel via-bg-panel/80 to-transparent" />

            <div className="relative grid gap-6 p-6 md:grid-cols-[auto_1fr] md:p-8">
              <div className="relative">
                <div className="absolute -inset-2 rounded-3xl bg-neon-gradient opacity-40 blur-xl animate-pulse" />
                <Avatar className="relative h-32 w-32 rounded-3xl ring-2 ring-neon-electric/40">
                  <AvatarImage src={player.avatar} />
                  <AvatarFallback className="rounded-3xl text-3xl">
                    {initials(player.handle)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neon">{player.game}</Badge>
                  <Badge variant="purple">{player.role}</Badge>
                  <Badge variant="warning">#{player.rank} ranked</Badge>
                </div>
                <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
                  <span className="text-gradient">{player.handle}</span>
                </h1>
                <p className="text-sm text-ink-muted">
                  {player.realName} · {player.countryCode} · age {player.age}
                </p>

                <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                  {[
                    ["Rating", player.rating],
                    ["K/D", player.kd],
                    ["ACS", player.acs],
                    ["MVPs", player.mvpCount],
                  ].map(([k, v]) => (
                    <div
                      key={k as string}
                      className="rounded-lg border border-white/[0.06] bg-bg-base/40 p-2.5"
                    >
                      <p className="text-[9.5px] uppercase tracking-widest text-ink-dim">
                        {k as string}
                      </p>
                      <p className="stat-num text-base font-bold text-ink">
                        {v as number}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Current bid display */}
            <div className="relative border-t border-white/[0.06] bg-bg-base/40 p-6 md:p-8">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-ink-dim">
                    Current bid
                  </p>
                  <motion.p
                    key={pulseKey}
                    initial={{ scale: 0.96, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 220, damping: 18 }}
                    className="stat-num mt-1 text-5xl font-bold text-gradient md:text-6xl"
                  >
                    {formatCurrency(currentBid)}
                  </motion.p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Base price {formatCurrency(base)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10"
                    style={{
                      background: `${topFranchise.primaryColor}22`,
                      boxShadow: `0 0 24px -6px ${topFranchise.primaryColor}`,
                    }}
                  >
                    <Crown className="h-5 w-5" style={{ color: topFranchise.primaryColor }} />
                  </div>
                  <div>
                    <p className="text-[10.5px] uppercase tracking-widest text-ink-dim">
                      Top bidder
                    </p>
                    <p className="font-display text-sm font-bold text-ink">
                      {topFranchise.name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {[50_000, 100_000, 250_000].map((inc) => (
                  <Button
                    key={inc}
                    variant="outline"
                    onClick={() => {
                      setCurrentBid((c) => c + inc);
                      setPulseKey((k) => k + 1);
                      setEndsAt(Date.now() + 8000);
                    }}
                  >
                    <Gavel className="h-4 w-4" />+ {formatCurrency(inc)}
                  </Button>
                ))}
                <Button
                  variant="primary"
                  onClick={() => {
                    setCurrentBid((c) => c + 500_000);
                    setPulseKey((k) => k + 1);
                    setEndsAt(Date.now() + 12000);
                  }}
                >
                  <Flame className="h-4 w-4" /> Power bid +$500K
                </Button>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-neon-purple/30 bg-neon-purple/5 px-3 py-2 text-xs">
                <Brain className="h-4 w-4 text-neon-purple" />
                <span className="text-ink-muted">AI fair value</span>
                <span className="stat-num font-bold text-neon-purple">
                  {formatCurrency(Math.round(player.earnings * 2.4))}
                </span>
                <span className="text-ink-dim">
                  · {Math.round((currentBid / (player.earnings * 2.4)) * 100)}%
                  of model
                </span>
              </div>
            </div>
          </div>

          {/* Bid feed */}
          <Card>
            <CardHeader>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-neon-electric">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Live bid feed</CardTitle>
                <p className="text-xs text-ink-muted">
                  {history.length} bids in this lot
                </p>
              </div>
            </CardHeader>
            <CardContent className="max-h-[420px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {displayHistory.map((b) => {
                  const f = franchises.find((x) => x.id === b.franchiseId);
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center justify-between border-b border-white/[0.05] py-2 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background: f?.primaryColor ?? "#888",
                            boxShadow: `0 0 8px ${f?.primaryColor ?? "#888"}`,
                          }}
                        />
                        <span className="font-mono text-xs text-ink-muted">
                          {b.franchiseTag}
                        </span>
                      </div>
                      <span className="stat-num text-sm font-semibold text-ink">
                        {formatCurrency(b.amount)}
                      </span>
                    </motion.div>
                  );
                })}
                {!displayHistory.length && (
                  <p className="py-8 text-center text-xs text-ink-muted">
                    Waiting for first bid…
                  </p>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Franchise wallets + chat */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Franchise wallets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {franchises.map((f) => {
                  const isTop = f.id === topFranchiseId;
                  const pctRemaining = (f.walletBalance / f.budget) * 100;
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "rounded-xl border bg-white/[0.02] p-3 transition-all",
                        isTop
                          ? "border-neon-electric/40 shadow-neon"
                          : "border-white/[0.06]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: f.primaryColor }}
                          />
                          <span className="font-display text-sm font-bold text-ink">
                            {f.tag}
                          </span>
                          {isTop && (
                            <Badge variant="neon" className="ml-1">
                              Top
                            </Badge>
                          )}
                        </div>
                        <span className="stat-num text-sm font-bold text-ink">
                          {formatCurrency(f.walletBalance)}
                        </span>
                      </div>
                      <Progress
                        value={pctRemaining}
                        className="mt-2 h-1"
                        indicatorClassName={isTop ? "" : "opacity-70"}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live chat</CardTitle>
              <p className="ml-auto text-xs text-ink-muted">{chat.length}</p>
            </CardHeader>
            <CardContent>
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1 text-sm">
                {chat.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2"
                  >
                    <p className="text-[11px] font-semibold text-neon-electric">
                      {c.user}
                    </p>
                    <p className="text-ink">{c.text}</p>
                  </div>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat();
                }}
              >
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Send a message…"
                />
                <Button type="submit" size="icon" aria-label="Send">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
