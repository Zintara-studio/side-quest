"use client";
import { players } from "@/lib/mock/players";
import { Section } from "@/components/common/section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

export function TopPlayers() {
  const list = players.slice(0, 6);
  return (
    <Section
      eyebrow="Power Index"
      title="Top players this week"
      description="Computed across 14 stat dimensions — KDA, impact, consistency, clutch rate, and more."
      href="/leaderboards"
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            viewport={{ once: true }}
          >
            <Link
              href={`/players/${p.id}`}
              className="panel group flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-white/15"
            >
              <div className="relative">
                <span className="stat-num absolute -left-1 -top-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-bg-base text-xs font-bold text-neon-electric">
                  {p.rank}
                </span>
                <Avatar className="h-14 w-14 ring-2 ring-neon-electric/30">
                  <AvatarImage src={p.avatar} alt={p.handle} />
                  <AvatarFallback>{initials(p.handle)}</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display text-base font-bold text-ink truncate">
                    {p.handle}
                  </p>
                  <span className="text-sm">{p.countryCode}</span>
                </div>
                <p className="text-xs text-ink-muted truncate">
                  {p.realName} · {p.role}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant="neon">{p.game}</Badge>
                  <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-neon-lime">
                    <TrendingUp className="h-3 w-3" /> {(p.kd * 100).toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10.5px] uppercase tracking-widest text-ink-dim">
                  Rating
                </p>
                <p className="stat-num text-2xl font-bold text-gradient">
                  {p.rating}
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
