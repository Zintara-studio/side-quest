"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { AuthCard, AuthError } from "./auth-ui";
import { useAuth, apiErrorMessage } from "@/lib/auth/context";
import { authApi } from "@/lib/api/endpoints";
import { safeNextPath } from "@/lib/nav";

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const next = params.get("next");
  const { verifyEmail } = useAuth();

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const code = digits.join("");

  const setAt = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const nextD = [...prev];
      nextD[i] = v;
      return nextD;
    });
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || pending) return;
    setError(null);
    setPending(true);
    try {
      const role = await verifyEmail(email, code);
      router.push(safeNextPath(next) ?? (role === "ADMIN" ? "/admin" : "/"));
    } catch (err) {
      setError(apiErrorMessage(err, "That code is invalid or has expired."));
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
      setPending(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || !email) return;
    try {
      await authApi.resendVerification({ email });
    } catch {
      /* never reveal delivery state */
    }
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const ready = code.length === 6 && !pending;

  return (
    <AuthCard
      eyebrow="Verify email"
      title="ENTER YOUR CODE"
      subtitle={
        email
          ? `We emailed a 6-digit code to ${email}. It expires in 10 minutes.`
          : "Enter the 6-digit code we emailed you."
      }
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

        <div style={{ marginTop: 16 }}>
          <AuthError>{error}</AuthError>
        </div>

        <button
          type="submit"
          disabled={!ready}
          style={{
            width: "100%",
            marginTop: 6,
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
          {pending ? "Verifying…" : "Verify ▸"}
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
          onClick={resend}
          disabled={cooldown > 0}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".06em",
            color: cooldown > 0 ? SQ.mute : SQ.ember,
            background: "transparent",
            border: "none",
            cursor: cooldown > 0 ? "not-allowed" : "pointer",
            padding: 0,
          }}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
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

export function VerifyEmailForm() {
  // useSearchParams must be inside a Suspense boundary or the production build fails to prerender.
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
