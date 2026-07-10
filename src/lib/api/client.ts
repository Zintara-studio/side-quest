// Axios instance for the Spring Boot API. Adds the bearer access token on every request and
// transparently rotates the refresh token on a 401, retrying the original request once.
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { authTokens } from "@/lib/auth/store";
import type { AuthResponse } from "@/lib/api/types";

// NEXT_PUBLIC_* is inlined at BUILD time, so this guard runs during `next build` and fails the build
// (not runtime) when the API URL wasn't provided — far better than shipping a bundle that silently
// calls http://localhost:8080 from every visitor's browser.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL must be set for a production build (e.g. https://api.your-domain.com/v1).",
  );
}
if (process.env.NEXT_PUBLIC_API_URL) {
  let parsed: URL;
  try {
    parsed = new URL(process.env.NEXT_PUBLIC_API_URL);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_API_URL is not a valid URL: "${process.env.NEXT_PUBLIC_API_URL}" (e.g. https://api.your-domain.com/v1).`,
    );
  }
  // Require https in production builds, except for localhost (local prod-mode smoke tests).
  const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:" && !isLocalhost) {
    throw new Error(
      `NEXT_PUBLIC_API_URL must use https in a production build (got "${parsed.protocol}//"); http is only allowed for localhost.`,
    );
  }
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/v1";

/**
 * Build a WebSocket URL under the API. Maps http→ws / https→wss and keeps the full API base INCLUDING
 * the /v1 context path (the WS endpoints are registered under it, e.g. /v1/ws/live/auctions/{id}), then
 * appends `path`. Pass the servlet-relative path (e.g. "/ws/live/auctions/{id}?token=...").
 */
export function wsUrl(path: string): string {
  const base = API_BASE_URL.replace(/^http/i, "ws");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Resolve a stored media reference to a browser-loadable URL. Uploaded images are stored as
 * {@code /media/{id}} relative to the API's context path, so they must be served from the API origin
 * (not the frontend). Absolute http(s) urls and data URLs are returned unchanged.
 */
export function mediaSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:)/i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// A bare client (no interceptors) used only for the refresh call, to avoid recursion.
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Single in-flight refresh shared by all concurrent callers.
let refreshing: Promise<string | null> | null = null;

async function rotateRefreshToken(): Promise<string | null> {
  const refreshToken = authTokens.getRefresh();
  if (!refreshToken) return null;
  try {
    const { data } = await refreshClient.post<AuthResponse>("/auth/refresh", {
      refreshToken,
    });
    authTokens.setSession(data);
    return data.accessToken;
  } catch {
    authTokens.clear();
    return null;
  }
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let token = authTokens.getAccess();
  // On a fresh page load the access token lives in memory only, so it's null until re-minted.
  // If we have a refresh token, mint the access token FIRST (sharing the single in-flight refresh)
  // rather than firing the request unauthenticated and eating a 401 + retry on every reload.
  if (!token && authTokens.getRefresh()) {
    if (!refreshing) {
      refreshing = rotateRefreshToken().finally(() => {
        refreshing = null;
      });
    }
    token = await refreshing;
  }
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retried?: boolean })
      | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      authTokens.getRefresh()
    ) {
      original._retried = true;
      if (!refreshing) refreshing = rotateRefreshToken().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        const headers = AxiosHeaders.from(original.headers as AxiosHeaders);
        headers.set("Authorization", `Bearer ${newToken}`);
        original.headers = headers;
        return api.request(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Normalizes an axios error into a human-readable message from the backend's ApiError shape. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; error?: string; detail?: string }
      | undefined;
    return data?.message ?? data?.error ?? data?.detail ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
