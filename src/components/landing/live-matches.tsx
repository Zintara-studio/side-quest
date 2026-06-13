"use client";
import { matches } from "@/lib/mock/matches";
import { Section } from "@/components/common/section";
import { LiveIndicator } from "@/components/common/live-indicator";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { motion } from "framer-motion";

export function LiveMatches() {
  const list = matches.filter((m) => m.status !== "scheduled").slice(0, 4);
  return (
    <Section
      eyebrow="On Air"
      title="Live & recent matches"
      description="Round-by-round scoreboards, kill feeds, and economy charts — broadcast quality."
      href="/leaderboards"
      hrefLabel="Match center"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {list.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            viewport={{ once: true, margin: "-10%" }}
          >
            <Link
              href="#"
              className="panel group block p-5 transition-all hover:-translate-y-0.5 hover:border-white/15"
            >
              <div className="flex items-center justify-between">
                {m.status === "live" ? (
                  <LiveIndicator />
                ) : (
                  <Badge variant="default">FT</Badge>
                )}
                <span className="text-[10.5px] font-mono uppercase tracking-widest text-ink-dim">
                  {m.game} · {m.round}
                </span>
              </div>

              {[m.teamA, m.teamB].map((t, idx) => {
                const winning = idx === 0 ? t.score >= m.teamB.score : t.score >= m.teamA.score;
                return (
                  <div
                    key={t.id + idx}
                    className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md border border-white/10 bg-white/[0.04]" />
                      <span
                        className={
                          winning
                            ? "font-display text-sm font-semibold text-ink"
                            : "font-display text-sm font-medium text-ink-muted"
                        }
                      >
                        {t.name}
                      </span>
                    </div>
                    <span
                      className={
                        winning
                          ? "stat-num text-xl font-bold text-neon-electric"
                          : "stat-num text-xl font-bold text-ink-muted"
                      }
                    >
                      {t.score}
                    </span>
                  </div>
                );
              })}

              <div className="mt-3 flex items-center justify-between text-xs text-ink-dim">
                <span>BO{m.bestOf}</span>
                <span className="font-mono">{m.tournamentId}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
