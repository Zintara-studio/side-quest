"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { AuthCard } from "./auth-ui";

export function TwoFactorForm() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");

  const setAt = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) router.push("/");
  };

  const ready = code.length === 6;

  return (
    <AuthCard
      eyebrow="Two-factor"
      title="VERIFY CODE"
      subtitle="Enter the 6-digit code from your authenticator app."
    >
      <form onSubmit={onSubmit}>
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="sq-field"
              inputMode="numeric"
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              style={{
                width: 48,
                textAlign: "center",
                background: SQ.inset,
                border: `1px solid ${SQ.field}`,
                borderRadius: 6,
                padding: "14px 0",
                fontFamily: FONT.mono,
                fontSize: 20,
                color: SQ.ink,
              }}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={!ready}
          style={{
            width: "100%",
            marginTop: 22,
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: SQ.league,
            background: SQ.red,
            border: "none",
            padding: 13,
            borderRadius: 5,
            cursor: ready ? "pointer" : "not-allowed",
            opacity: ready ? 1 : 0.5,
          }}
        >
          Verify ▸
        </button>
      </form>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => setDigits(["", "", "", "", "", ""])}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".06em",
            color: SQ.faint,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Resend code
        </button>
        <Link
          href="/login"
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".14em",
            color: SQ.mute,
            textDecoration: "none",
          }}
        >
          ◂ Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
