"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export default function TwoFAPage() {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const update = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const complete = digits.every((d) => d !== "");

  return (
    <>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neon-electric/40 bg-neon-electric/10 text-neon-electric">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-bold text-ink md:text-3xl">
        Verify your identity
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Enter the 6-digit code from your authenticator app.
      </p>

      <div className="mt-7 flex gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            className="h-14 w-12 rounded-xl border border-white/10 bg-white/[0.03] text-center font-display text-2xl font-bold text-ink transition-colors focus:border-neon-electric/60 focus:outline-none focus:ring-2 focus:ring-neon-electric/30"
          />
        ))}
      </div>

      <Button
        size="lg"
        className="mt-7 w-full"
        disabled={!complete}
        asChild={complete}
      >
        {complete ? <Link href="/">Verify and continue</Link> : <>Verify</>}
      </Button>

      <p className="mt-5 text-center text-xs text-ink-muted">
        Didn't get a code?{" "}
        <button className="font-semibold text-neon-electric hover:underline">
          Resend
        </button>
      </p>
    </>
  );
}
