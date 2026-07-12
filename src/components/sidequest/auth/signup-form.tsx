"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SQ } from "../tokens";
import { useAuth, apiErrorMessage } from "@/lib/auth/context";
import { safeNextPath } from "@/lib/nav";
import { useCurrentSeason } from "@/lib/query/hooks";
import {
  AuthCard,
  AuthField,
  AuthSubmit,
  AuthError,
  OrDivider,
  SocialRow,
  hasGoogleAuth,
  AuthFootnote,
  authLinkStyle,
} from "./auth-ui";

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const season = useCurrentSeason().data;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      // Backend has no 2FA/email-verification step yet — registration returns a live session.
      await signup({ name, email, password });
      // No session yet — head to email verification, carrying any safe ?next= through for afterwards.
      const params = new URLSearchParams({ email });
      const safeNext = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      if (safeNext) params.set("next", safeNext);
      router.push(`/verify-email?${params.toString()}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create account."));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthCard
      eyebrow={season?.name ?? "Community League"}
      title="CREATE ACCOUNT"
      subtitle="Join the league — claim your handle, then register for a title."
    >
      <form onSubmit={onSubmit}>
        <AuthField
          label="DISPLAY NAME"
          name="name"
          placeholder="e.g. Raghavan"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
        <AuthField
          label="PASSWORD"
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
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 9,
            fontSize: 12.5,
            color: SQ.mute,
            lineHeight: 1.5,
            margin: "2px 0 18px",
            cursor: "pointer",
          }}
        >
          <input type="checkbox" required style={{ accentColor: SQ.red, marginTop: 2 }} />
          <span>
            I agree to the{" "}
            <Link href="/rules" target="_blank" style={authLinkStyle}>
              Side Quest league rules &amp; fair-play policy
            </Link>
            .
          </span>
        </label>
        <AuthError>{error}</AuthError>
        <AuthSubmit disabled={pending}>
          {pending ? "Creating account…" : "Create account ▸"}
        </AuthSubmit>
      </form>
      {hasGoogleAuth ? (
        <>
          <OrDivider />
          <SocialRow />
        </>
      ) : null}
      <AuthFootnote>
        Already registered?{" "}
        <Link href="/login" style={authLinkStyle}>
          Sign in
        </Link>
      </AuthFootnote>
    </AuthCard>
  );
}
