"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { useAuth, apiErrorMessage } from "@/lib/auth/context";
import {
  AuthCard,
  AuthField,
  AuthSubmit,
  AuthError,
  OrDivider,
  SocialRow,
  AuthFootnote,
  authLinkStyle,
} from "./auth-ui";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const role = await login({ identifier: email, password });
      router.push(role === "ADMIN" ? "/admin" : "/");
    } catch (err) {
      setError(apiErrorMessage(err, "Invalid email or password."));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthCard eyebrow="Welcome back" title="SIGN IN">
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
        <AuthField
          label="PASSWORD"
          type="password"
          reveal
          name="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "2px 0 18px",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              color: SQ.mute,
              cursor: "pointer",
            }}
          >
            <input type="checkbox" style={{ accentColor: SQ.red }} defaultChecked />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".06em",
              color: SQ.faint,
              textDecoration: "none",
            }}
          >
            Forgot?
          </Link>
        </div>
        <AuthError>{error}</AuthError>
        <AuthSubmit disabled={pending}>{pending ? "Signing in…" : "Sign in ▸"}</AuthSubmit>
      </form>
      <OrDivider />
      <SocialRow />
      <AuthFootnote>
        New to Side Quest?{" "}
        <Link href="/signup" style={authLinkStyle}>
          Create account
        </Link>
      </AuthFootnote>
    </AuthCard>
  );
}
