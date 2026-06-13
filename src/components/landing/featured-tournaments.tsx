"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { tournaments } from "@/lib/mock/tournaments";
import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { LiveIndicator } from "@/components/common/live-indicator";
import { Countdown } from "@/components/common/countdown";
import { formatCurrency } from "@/lib/utils";
import { Calendar, Globe, Users } from "lucide-react";

export function FeaturedTournaments() {
  const list = tournaments.filter((t) => t.status !== "completed").slice(0, 4);
  return (
    <Section
      eyebrow="Tournaments"
      title="Marquee events of the season"
      description="The headline circuits, with brackets, prize pools, and live scores in one feed."
      href="/tournaments/vct-champions-2026"
      hrefLabel="Browse all"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            viewport={{ once: true, margin: "-10%" }}
          >
            <Link
              href={`/tournaments/${t.id}`}
              className="group panel relative block overflow-hidden transition-all hover:-translate-y-0.5 hover:border-white/15"
            >
              <div
                className="absolute inset-0 opacity-30 transition-opacity group-hover:opacity-50"
                style={{
                  backgroundImage: `linear-gradient(135deg, transparent 30%, rgba(0,0,0,0.5) 100%), url(${t.cover})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-panel via-bg-panel/85 to-transparent" />
              <div className="relative grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {t.status === "live" ? (
                      <LiveIndicator />
                    ) : (
                      <Badge variant="neon">{t.status}</Badge>
                    )}
                    <Badge variant="purple">{t.game.toUpperCase()}</Badge>
                    <Badge>{t.format.replace("-", " ")}</Badge>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-ink md:text-2xl">
                    {t.name}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> {t.region}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {t.teamCount} teams
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(t.startsAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <p className="text-xs uppercase tracking-widest text-ink-dim">
                    Prize pool
                  </p>
                  <p className="stat-num text-3xl font-bold text-gradient">
                    {formatCurrency(t.prizePool)}
                  </p>
                  {t.status === "upcoming" && (
                    <Countdown to={t.startsAt} compact />
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
