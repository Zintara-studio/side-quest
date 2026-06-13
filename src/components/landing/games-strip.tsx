"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { games } from "@/lib/mock/games";
import { formatCompact } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

export function GamesStrip() {
  return (
    <section className="container py-10">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        {games.map((g, i) => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            viewport={{ once: true, margin: "-15%" }}
          >
            <Link
              href={`/games/${g.id}`}
              className="group panel relative block overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-white/15"
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl opacity-50 transition-opacity group-hover:opacity-80"
                style={{
                  background:
                    g.accent === "pink"
                      ? "rgba(236,72,153,0.5)"
                      : g.accent === "purple"
                        ? "rgba(168,85,247,0.5)"
                        : g.accent === "electric"
                          ? "rgba(0,229,255,0.5)"
                          : g.accent === "lime"
                            ? "rgba(163,230,53,0.5)"
                            : "rgba(245,158,11,0.5)",
                }}
              />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold text-ink">
                    {g.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">{g.tagline}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-ink-dim transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
              <div className="relative mt-5 flex items-baseline gap-4 text-xs text-ink-muted">
                <span>
                  <span className="stat-num text-base font-semibold text-ink">
                    {formatCompact(g.players)}
                  </span>{" "}
                  players
                </span>
                <span>·</span>
                <span>
                  <span className="stat-num text-base font-semibold text-ink">
                    {g.tournaments}
                  </span>{" "}
                  events
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
