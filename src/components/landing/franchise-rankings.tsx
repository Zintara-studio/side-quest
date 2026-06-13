"use client";
import { franchises } from "@/lib/mock/franchises";
import { Section } from "@/components/common/section";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";

export function FranchiseRankings() {
  const list = [...franchises].sort((a, b) => a.ranking - b.ranking).slice(0, 6);
  const maxWins = Math.max(...list.map((f) => f.wins));

  return (
    <Section
      eyebrow="Power Rankings"
      title="Franchise leaderboard"
      description="Aggregated across all leagues — wins, prize earnings, roster strength, and form."
      href="/leaderboards"
    >
      <div className="panel divide-y divide-white/[0.05]">
        {list.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            viewport={{ once: true }}
          >
            <Link
              href={`/franchises/${f.id}`}
              className="group grid grid-cols-[40px_1.6fr_1fr_1.2fr_1fr] items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]"
            >
              <span className="stat-num text-2xl font-bold text-ink-dim group-hover:text-neon-electric transition-colors">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-10 w-10 shrink-0 rounded-lg border border-white/10"
                  style={{
                    background: `${f.primaryColor}22`,
                    boxShadow: `0 0 18px -6px ${f.primaryColor}`,
                  }}
                />
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-ink truncate">
                    {f.name}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {f.region} · {f.tag}
                  </p>
                </div>
              </div>
              <div className="hidden md:block">
                <Badge variant="purple">{f.game}</Badge>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-ink-muted">W/L</span>
                  <span className="stat-num font-semibold text-ink">
                    {f.wins}-{f.losses}
                  </span>
                </div>
                <Progress
                  value={(f.wins / maxWins) * 100}
                  className="mt-1.5 h-1"
                />
              </div>
              <div className="text-right">
                <p className="text-[10.5px] uppercase tracking-widest text-ink-dim">
                  Trophies
                </p>
                <p className="stat-num text-base font-bold text-ink">
                  {f.trophies}
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
