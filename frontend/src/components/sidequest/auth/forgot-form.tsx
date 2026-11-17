"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { AuthCard, AuthField, AuthSubmit, AuthError } from "./auth-ui";
import { apiErrorMessage } from "@/lib/auth/context";
import { authApi } from "@/lib/api/endpoints";

function BackToSignIn() {
  return (
    <div style={{ marginTop: 22, textAlign: "center" }}>
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
  );
}

export function ForgotForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await authApi.forgotPassword({ email });
    } catch {
      // Never reveal whether the email is registered — always advance.
    }
    setPending(false);
    setStep("reset");
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      await authApi.resetPassword({ email, code, newPassword: password });
      router.push("/login?reset=1");
    } catch (err) {
      setError(apiErrorMessage(err, "That code is invalid or has expired."));
      setPending(false);
    }
  };

  if (step === "reset") {
    return (
      <AuthCard
        eyebrow="Account recovery"
        title="SET A NEW PASSWORD"
        subtitle={`If an account exists for ${email || "that address"}, we emailed a 6-digit code. Enter it with your new password.`}
      >
        <form onSubmit={submitReset}>
          <AuthField
            label="6-DIGIT CODE"
            name="code"
            inputMode="numeric"
            placeholder="123456"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <AuthField
            label="NEW PASSWORD"
            type="password"
            reveal
            name="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <AuthField
            label="CONFIRM PASSWORD"
            type="password"
            reveal
            name="confirmPassword"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <AuthError>{error}</AuthError>
          <AuthSubmit disabled={pending}>
            {pending ? "Resetting…" : "Reset password ▸"}
          </AuthSubmit>
        </form>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
          style={{
            width: "100%",
            marginTop: 12,
            fontFamily: FONT.mono,
            fontSize: 11.5,
            letterSpacing: ".08em",
            color: SQ.faint,
            background: "transparent",
            border: `1px solid ${SQ.inputBorder}`,
            padding: 12,
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          Use a different email
        </button>
        <BackToSignIn />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="RESET PASSWORD"
      subtitle="Enter your email and we'll send a 6-digit code to reset your password."
    >
      <form onSubmit={requestCode}>
        <AuthField
          label="EMAIL"
          type="email"
          name="email"
          placeholder="you@email.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthError>{error}</AuthError>
        <AuthSubmit disabled={pending}>{pending ? "Sending…" : "Send reset code ▸"}</AuthSubmit>
      </form>
      <BackToSignIn />
    </AuthCard>
  );
}
