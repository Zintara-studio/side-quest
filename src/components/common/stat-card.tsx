import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";

export function StatCard({
  label,
  value,
  delta,
  icon,
  accent = "electric",
  format = "compact",
  className,
}: {
  label: string;
  value: number;
  delta?: number;
  icon?: React.ReactNode;
  accent?: "electric" | "purple" | "pink" | "lime" | "amber";
  format?: "compact" | "plain" | "currency";
  className?: string;
}) {
  const accentMap: Record<string, string> = {
    electric: "from-neon-electric/30 to-transparent text-neon-electric",
    purple: "from-neon-purple/30 to-transparent text-neon-purple",
    pink: "from-neon-pink/30 to-transparent text-neon-pink",
    lime: "from-neon-lime/30 to-transparent text-neon-lime",
    amber: "from-neon-amber/30 to-transparent text-neon-amber",
  };

  return (
    <div
      className={cn(
        "panel group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5",
        "hover:border-white/15 shine",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-radial blur-2xl opacity-60",
          "bg-gradient-to-br",
          accentMap[accent],
        )}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-dim">
            {label}
          </p>
          <p className="stat-num mt-2 text-3xl font-bold text-ink md:text-4xl">
            <AnimatedCounter value={value} format={format} />
          </p>
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]",
              accentMap[accent].split(" ").pop(),
            )}
          >
            {icon}
          </div>
        )}
      </div>
      {typeof delta === "number" && (
        <div
          className={cn(
            "relative mt-4 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
            delta >= 0
              ? "bg-neon-lime/10 text-neon-lime"
              : "bg-neon-red/10 text-neon-red",
          )}
        >
          {delta >= 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {Math.abs(delta).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
