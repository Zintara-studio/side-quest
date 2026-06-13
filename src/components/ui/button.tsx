"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 focus-ring relative overflow-hidden",
  {
    variants: {
      variant: {
        primary:
          "bg-neon-gradient text-black hover:brightness-110 hover:shadow-glow active:scale-[0.98]",
        secondary:
          "bg-white/[0.06] text-ink border border-white/10 hover:bg-white/[0.1] hover:border-white/20",
        ghost: "text-ink-muted hover:text-ink hover:bg-white/[0.05]",
        outline:
          "border border-neon-electric/40 text-neon-electric hover:bg-neon-electric/10 hover:border-neon-electric/70 hover:shadow-neon",
        danger:
          "bg-neon-red/90 text-white hover:bg-neon-red hover:shadow-[0_0_24px_-4px_rgba(239,68,68,0.6)]",
        success:
          "bg-neon-lime/90 text-black hover:bg-neon-lime hover:shadow-[0_0_24px_-4px_rgba(163,230,53,0.6)]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
