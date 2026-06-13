"use client";
import { StatCard } from "@/components/common/stat-card";
import { Activity, DollarSign, Trophy, Users } from "lucide-react";

export function StatsCounters() {
  return (
    <section className="container py-10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active players"
          value={1_248_312}
          delta={12.4}
          icon={<Users className="h-5 w-5" />}
          accent="electric"
        />
        <StatCard
          label="Live events"
          value={47}
          delta={6.8}
          icon={<Activity className="h-5 w-5" />}
          accent="pink"
          format="plain"
        />
        <StatCard
          label="Prize awarded"
          value={58_400_000}
          delta={22.1}
          icon={<Trophy className="h-5 w-5" />}
          accent="amber"
          format="currency"
        />
        <StatCard
          label="Auction volume"
          value={42_800_000}
          delta={-3.2}
          icon={<DollarSign className="h-5 w-5" />}
          accent="purple"
          format="currency"
        />
      </div>
    </section>
  );
}
