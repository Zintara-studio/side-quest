// Auth session store. The access token lives in memory only (re-minted from the refresh
// token on reload, per the plan's XSS guidance); the refresh token is persisted to
// localStorage so a returning visitor stays signed in across reloads.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AdminLevel, AuthResponse, AuthUserView, MeResponse } from "@/lib/api/types";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Admin tier (orthogonal to role) — "NONE" for a plain player. */
  adminLevel: AdminLevel;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  /** The signed-in user's player profile id (from /auth/me), or null if they have none. */
  playerId: string | null;
  /** The signed-in user's gamerTag (from /auth/me) — used for pretty /player/<tag> links. */
  gamerTag: string | null;
  /** The signed-in user's avatar (from /auth/me) — drives the nav-bar avatar. null → gradient fallback. */
  avatarUrl: string | null;
  /** True while a fresh SSO account still must complete onboarding (pick a username). Gates the app. */
  onboardingRequired: boolean;
  /** Whether the initial refresh-on-load has resolved (success or failure). */
  hydrated: boolean;

  setSession: (auth: AuthResponse) => void;
  setUser: (me: MeResponse) => void;
  setHydrated: (v: boolean) => void;
  clear: () => void;
}

const toUser = (u: AuthUserView): SessionUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  adminLevel: u.adminLevel,
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      playerId: null,
      gamerTag: null,
      avatarUrl: null,
      onboardingRequired: false,
      hydrated: false,

      setSession: (auth) =>
        set({
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          user: toUser(auth.user),
          onboardingRequired: auth.user.onboardingRequired,
        }),

      setUser: (me) =>
        set({
          user: {
            id: me.user.id,
            name: me.user.name,
            email: me.user.email,
            role: me.user.role,
            adminLevel: me.user.adminLevel,
          },
          playerId: me.player?.id ?? null,
          gamerTag: me.player?.gamerTag ?? null,
          // Prefer the player's avatar; fall back to the account-level avatar (the league admin has no
          // player, so their avatar lives on the user).
          avatarUrl: me.player?.avatarUrl ?? me.user?.avatarUrl ?? null,
          // Fall back to the last-known flag when a session has no player yet (shouldn't happen post-signup).
          onboardingRequired: me.player?.onboardingRequired ?? false,
        }),

      setHydrated: (v) => set({ hydrated: v }),

      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          playerId: null,
          gamerTag: null,
          avatarUrl: null,
          onboardingRequired: false,
        }),
    }),
    {
      name: "sq-auth",
      storage: createJSONStorage(() => localStorage),
      // Only the refresh token survives a reload; access token is re-minted from it.
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    },
  ),
);

/** Non-React accessors so the axios interceptor can read/refresh tokens. */
export const authTokens = {
  getAccess: () => useAuthStore.getState().accessToken,
  getRefresh: () => useAuthStore.getState().refreshToken,
  setSession: (auth: AuthResponse) => useAuthStore.getState().setSession(auth),
  clear: () => useAuthStore.getState().clear(),
};
