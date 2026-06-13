"use client";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { formatCompact } from "@/lib/utils";

export function AnimatedCounter({
  value,
  format = "compact",
  decimals = 0,
  duration = 1.6,
  className,
}: {
  value: number;
  format?: "compact" | "plain" | "currency";
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(spring, (v) => {
    if (format === "compact") return formatCompact(v);
    if (format === "currency")
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v);
    return v.toLocaleString("en-US", { maximumFractionDigits: decimals });
  });

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}
