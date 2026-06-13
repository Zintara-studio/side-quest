"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { AuthCard, AuthField, AuthSubmit } from "./auth-ui";

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
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  if (sent) {
    return (
      <AuthCard
        eyebrow="Account recovery"
        title="CHECK YOUR INBOX"
        subtitle={`If an account exists for ${email || "that address"}, a reset link is on its way. It expires in 30 minutes.`}
      >
        <button
          type="button"
          onClick={() => setSent(false)}
          style={{
            width: "100%",
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
      subtitle="Enter your email and we'll send a link to reset your password."
    >
      <form onSubmit={onSubmit}>
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
        <AuthSubmit>Send reset link ▸</AuthSubmit>
      </form>
      <BackToSignIn />
    </AuthCard>
  );
}
