"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Countdown({
  to,
  className,
  compact = false,
}: {
  to: string | number | Date;
  className?: string;
  compact?: boolean;
}) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);

  const part = (label: string, val: number) => (
    <span className="inline-flex flex-col items-center">
      <span className="stat-num text-xl md:text-2xl font-bold text-ink">
        {val.toString().padStart(2, "0")}
      </span>
      <span className="text-[9px] uppercase tracking-widest text-ink-dim">
        {label}
      </span>
    </span>
  );

  if (compact) {
    return (
      <span className={cn("stat-num font-mono text-sm text-neon-electric", className)}>
        {d > 0 ? `${d}d ` : ""}
        {h.toString().padStart(2, "0")}:{m.toString().padStart(2, "0")}:
        {s.toString().padStart(2, "0")}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {part("days", d)}
      <span className="text-ink-dim">:</span>
      {part("hrs", h)}
      <span className="text-ink-dim">:</span>
      {part("min", m)}
      <span className="text-ink-dim">:</span>
      {part("sec", s)}
    </div>
  );
}
