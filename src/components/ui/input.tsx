"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm",
      "text-ink placeholder:text-ink-dim transition-colors",
      "hover:border-white/20 focus:border-neon-electric/60 focus:bg-white/[0.06]",
      "focus:outline-none focus:ring-2 focus:ring-neon-electric/30",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
