"use client";

// React auth context layered over the zustand session store. On mount, if a refresh token
// survived in localStorage, it silently re-mints a session via GET /auth/me (the axios
// interceptor performs the token rotation), so a returning visitor stays signed in.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi } from "@/lib/api/endpoints";
import { apiErrorMessage } from "@/lib/api/client";
import { useAuthStore, type SessionUser } from "@/lib/auth/store";
import type { LoginRequest, RegisterRequest } from "@/lib/api/types";

interface AuthContextValue {
  user: SessionUser | null;
  playerId: string | null;
  /** The signed-in user's gamerTag, for pretty /player/<tag> links (null if no player profile). */
  gamerTag: string | null;
  /** True while a fresh SSO account still must complete onboarding (pick a username). */
  onboardingRequired: boolean;
  isAuthenticated: boolean;
  /** Any admin tier (appointed admin or the main admin). */
  isAdmin: boolean;
  /** The single main admin — gates the sensitive, undo-less actions + admin appointment. */
  isSuperAdmin: boolean;
  hydrated: boolean;
  /** Resolves to the signed-in user's role (e.g. "ADMIN") so callers can route accordingly. */
  login: (body: LoginRequest) => Promise<string>;
  /** Registers the account; no session is issued until the email is verified. */
  signup: (body: RegisterRequest) => Promise<{ verificationRequired: boolean; email: string }>;
  /** Confirms the email with its OTP, establishes the session and returns the role. */
  verifyEmail: (email: string, code: string) => Promise<string>;
  /** Signs in with a Google id_token (verified server-side); returns the role + onboarding flag. */
  googleLogin: (idToken: string) => Promise<{ role: string; onboardingRequired: boolean }>;
  /** Re-fetches /auth/me into the session store (e.g. after onboarding flips onboardingRequired). */
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, playerId, gamerTag, onboardingRequired, accessToken, refreshToken, hydrated, setSession, setUser, setHydrated, clear } =
    useAuthStore();
  // Avoid a hydration mismatch: render the server/initial state until mounted on the client.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || hydrated) return;
    let cancelled = false;
    const stored = useAuthStore.getState().refreshToken;
    if (!stored) {
      setHydrated(true);
      return;
    }
    authApi
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) clear();
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, hydrated, setUser, setHydrated, clear]);

  const login = async (body: LoginRequest) => {
    const auth = await authApi.login(body);
    setSession(auth);
    try {
      setUser(await authApi.me());
    } catch {
      /* player id resolves on next load */
    }
    return auth.user.role;
  };

  const signup = async (body: RegisterRequest) => {
    // No session is issued at registration — the account must verify its email first.
    const res = await authApi.register(body);
    return { verificationRequired: res.verificationRequired, email: res.email };
  };

  const verifyEmail = async (email: string, code: string) => {
    const auth = await authApi.verifyEmail({ email, code });
    setSession(auth);
    try {
      setUser(await authApi.me());
    } catch {
      /* player id resolves on next load */
    }
    return auth.user.role;
  };

  const googleLogin = async (idToken: string) => {
    const auth = await authApi.google(idToken);
    setSession(auth);
    try {
      setUser(await authApi.me());
    } catch {
      /* player id resolves on next load */
    }
    // Surface the onboarding flag so the caller can route a brand-new SSO user to /onboarding.
    return { role: auth.user.role, onboardingRequired: auth.user.onboardingRequired };
  };

  const refreshUser = async () => {
    try {
      setUser(await authApi.me());
    } catch {
      /* leave the current session snapshot in place on a transient failure */
    }
  };

  const logout = async () => {
    const token = useAuthStore.getState().refreshToken ?? undefined;
    try {
      await authApi.logout(token);
    } catch {
      // best-effort revoke; clear the local session regardless
    }
    clear();
  };

  const value: AuthContextValue = {
    user,
    playerId,
    gamerTag,
    onboardingRequired,
    isAuthenticated: Boolean(accessToken || refreshToken || user),
    isAdmin: (user?.adminLevel ?? "NONE") !== "NONE",
    isSuperAdmin: user?.adminLevel === "SUPER_ADMIN",
    hydrated: mounted ? hydrated : false,
    login,
    signup,
    verifyEmail,
    googleLogin,
    refreshUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export { apiErrorMessage };
