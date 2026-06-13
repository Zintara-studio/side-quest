import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider border",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/5 text-ink",
        neon: "border-neon-electric/40 bg-neon-electric/10 text-neon-electric",
        purple: "border-neon-purple/40 bg-neon-purple/10 text-neon-purple",
        pink: "border-neon-pink/40 bg-neon-pink/10 text-neon-pink",
        success: "border-neon-lime/40 bg-neon-lime/10 text-neon-lime",
        danger: "border-neon-red/40 bg-neon-red/10 text-neon-red",
        warning: "border-neon-amber/40 bg-neon-amber/10 text-neon-amber",
        live: "border-neon-red/50 bg-neon-red/15 text-neon-red shadow-[0_0_12px_-2px_rgba(239,68,68,0.5)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
