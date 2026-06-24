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
  isAuthenticated: boolean;
  isAdmin: boolean;
  hydrated: boolean;
  /** Resolves to the signed-in user's role (e.g. "ADMIN") so callers can route accordingly. */
  login: (body: LoginRequest) => Promise<string>;
  signup: (body: RegisterRequest) => Promise<string>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, playerId, accessToken, refreshToken, hydrated, setSession, setUser, setHydrated, clear } =
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
    const auth = await authApi.register(body);
    setSession(auth);
    try {
      setUser(await authApi.me());
    } catch {
      /* player id resolves on next load */
    }
    return auth.user.role;
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
    isAuthenticated: Boolean(accessToken || refreshToken || user),
    isAdmin: user?.role === "ADMIN",
    hydrated: mounted ? hydrated : false,
    login,
    signup,
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
